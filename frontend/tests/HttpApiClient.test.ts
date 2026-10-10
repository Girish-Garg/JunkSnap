import { describe, expect, it } from 'vitest';
import { BBox } from '../src/domain/BBox';
import { HttpApiClient } from '../src/services/HttpApiClient';

function fakeFetch(status: number, body: unknown, calls: string[] = []): typeof fetch {
  return async (input) => {
    calls.push(String(input));
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
}

describe('HttpApiClient', () => {
  it('calls GET /sites with the bbox and returns the features', async () => {
    const calls: string[] = [];
    const feature = { type: 'Feature', properties: { site_id: 'site_x' } };
    const api = new HttpApiClient('https://api.example.test/', fakeFetch(200, { type: 'FeatureCollection', features: [feature] }, calls));
    const sites = await api.listSites(new BBox(73, 26, 73.5, 26.5));
    expect(calls).toEqual(['https://api.example.test/sites?bbox=73.00000,26.00000,73.50000,26.50000']);
    expect(sites).toEqual([feature]);
  });

  it('maps an error body to ApiError with the contract code', async () => {
    const api = new HttpApiClient('https://api.example.test', fakeFetch(404, { error: 'not_found', message: 'No site' }));
    await expect(api.getSite('site_missing')).rejects.toMatchObject({ status: 404, code: 'not_found', message: 'No site' });
  });

  it('maps a network failure to ApiError network_error', async () => {
    const offline: typeof fetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    const api = new HttpApiClient('https://api.example.test', offline);
    await expect(api.getSite('site_x')).rejects.toMatchObject({ status: 0, code: 'network_error' });
  });
});

interface Seen {
  readonly url: string;
  readonly ifNoneMatch: string | null;
}

interface Served {
  current: unknown;
  etag: string;
}

// Answers 200 with the ETag, or 304 with no body to a matching If-None-Match.
function taggedServer(served: Served, seen: Seen[]): typeof fetch {
  return async (input, init) => {
    const ifNoneMatch = new Headers(init?.headers).get('If-None-Match');
    seen.push({ url: String(input), ifNoneMatch });
    if (ifNoneMatch === served.etag) return new Response(null, { status: 304, headers: { ETag: served.etag } });
    return new Response(JSON.stringify(served.current), { status: 200, headers: { ETag: served.etag } });
  };
}

const site = (status: string) => ({ type: 'Feature', properties: { site_id: 'site_x', status } });

describe('HttpApiClient conditional reads', () => {
  it('sends If-None-Match from the cached ETag and reuses the cached body on a 304', async () => {
    const seen: Seen[] = [];
    const served: Served = { current: site('open'), etag: '"v1"' };
    const api = new HttpApiClient('https://api.example.test', taggedServer(served, seen));
    expect(await api.getSite('site_x')).toEqual(site('open'));
    expect(await api.getSite('site_x')).toEqual(site('open'));
    served.current = site('cleaned');
    served.etag = '"v2"';
    expect(await api.getSite('site_x')).toEqual(site('cleaned'));
    expect(seen.map((call) => call.ifNoneMatch)).toEqual([null, '"v1"', '"v1"']);
  });

  it('keys site lists by bbox, each with its own ETag', async () => {
    const seen: Seen[] = [];
    const served: Served = { current: { type: 'FeatureCollection', features: [site('open')] }, etag: '"list"' };
    const api = new HttpApiClient('https://api.example.test', taggedServer(served, seen));
    await api.listSites(new BBox(73, 26, 73.5, 26.5));
    expect(await api.listSites(new BBox(73, 26, 73.5, 26.5))).toEqual([site('open')]);
    await api.listSites(new BBox(74, 26, 74.5, 26.5));
    expect(seen.map((call) => call.ifNoneMatch)).toEqual([null, '"list"', null]);
  });
});

describe('HttpApiClient failed refresh', () => {
  it('still rejects a failed refresh, so the map can say so, then revalidates the kept copy', async () => {
    let online = true;
    const seen: Seen[] = [];
    const server = taggedServer({ current: site('open'), etag: '"v1"' }, seen);
    const api = new HttpApiClient('https://api.example.test', (input, init) =>
      online ? server(input, init) : Promise.reject(new TypeError('Failed to fetch')),
    );
    await api.getSite('site_x');
    online = false;
    await expect(api.getSite('site_x')).rejects.toMatchObject({ code: 'network_error' });
    online = true;
    expect(await api.getSite('site_x')).toEqual(site('open'));
    expect(seen.map((call) => call.ifNoneMatch)).toEqual([null, '"v1"']);
  });
});
