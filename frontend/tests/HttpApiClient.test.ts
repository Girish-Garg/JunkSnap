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
