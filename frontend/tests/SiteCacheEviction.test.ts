import { describe, expect, it, vi } from 'vitest';
import { BBox } from '../src/domain/BBox';
import { EvictingSiteActionsApi } from '../src/services/EvictingSiteActionsApi';
import { HttpApiClient } from '../src/services/HttpApiClient';
import { SiteCaches } from '../src/services/SiteCaches';
import type { SiteActionsApi } from '../src/services/SiteActionsApi';
import { SystemClock } from '../src/services/SystemClock';

const SITE = { type: 'Feature', properties: { site_id: 'site_x' } };
const BOX = new BBox(73, 26, 73.5, 26.5);

// Records the If-None-Match of each request and answers 304 to the one ETag it hands out.
function server(seen: (string | null)[]): typeof fetch {
  return async (input, init) => {
    const tag = new Headers(init?.headers).get('If-None-Match');
    seen.push(tag);
    if (tag === '"v1"') return new Response(null, { status: 304, headers: { ETag: '"v1"' } });
    const body = String(input).includes('bbox') ? { type: 'FeatureCollection', features: [SITE] } : SITE;
    return new Response(JSON.stringify(body), { status: 200, headers: { ETag: '"v1"' } });
  };
}

function fakeActions() {
  const fail = () => Promise.reject(new Error('409'));
  return {
    vote: vi.fn(async () => ({})),
    cleanup: vi.fn(fail),
    withdraw: vi.fn(async () => ({})),
    letter: vi.fn(async () => ({})),
    note: vi.fn(async () => ({})),
    flagPhoto: vi.fn(async () => ({})),
  } as unknown as SiteActionsApi;
}

describe('SiteCaches.forgetSite', () => {
  it('drops the site and every tile, so the next reads fetch them whole', async () => {
    const seen: (string | null)[] = [];
    const caches = SiteCaches.standard(new SystemClock());
    const api = new HttpApiClient('https://api.example.test', server(seen), caches);
    await api.getSite('site_x');
    await api.listSites(BOX);
    await api.getSite('site_x');
    caches.forgetSite('site_x');
    await api.getSite('site_x');
    await api.listSites(BOX);
    expect(seen).toEqual([null, null, '"v1"', null, null]);
  });
});

describe('EvictingSiteActionsApi', () => {
  it('forgets the site after a vote, a withdrawal and even a refused cleanup, but not after a letter or note', async () => {
    const forgetSite = vi.fn();
    const actions = new EvictingSiteActionsApi(fakeActions(), { forgetSite });
    await actions.vote('site_a', {} as never);
    await actions.withdraw('site_b');
    await expect(actions.cleanup('site_c', {} as never)).rejects.toThrow('409');
    await actions.letter('site_d', {} as never);
    await actions.note('site_e', {} as never);
    expect(forgetSite.mock.calls).toEqual([['site_a'], ['site_b'], ['site_c']]);
  });

  it('forgets the site after a photo report, which can cover or hide a photo', async () => {
    const forgetSite = vi.fn();
    const actions = new EvictingSiteActionsApi(fakeActions(), { forgetSite });
    await actions.flagPhoto('site_f', 'rpt_f', {} as never);
    expect(forgetSite.mock.calls).toEqual([['site_f']]);
  });
});
