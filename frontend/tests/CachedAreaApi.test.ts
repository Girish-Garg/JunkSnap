import { describe, expect, it, vi } from 'vitest';
import type { AreaListing } from '../src/domain/AreaListing';
import { CachedAreaApi } from '../src/services/CachedAreaApi';
import type { Clock } from '../src/services/Clock';
import { ExpiringCache } from '../src/services/ExpiringCache';
import type { TaggedAreaApi } from '../src/services/TaggedAreaApi';

const listing = (within: string): AreaListing => ({ kind: 'assembly', within, total: 0, limit: 200, areas: [] });

function fakeApi() {
  const listTagged = vi.fn<TaggedAreaApi['listTagged']>(async (_kind, within) => ({ value: listing(within), token: `"${within}"` }));
  const api = { listTagged, list: vi.fn(), scores: vi.fn(), crawl: vi.fn() } as unknown as TaggedAreaApi;
  return { api, listTagged };
}

class FakeClock implements Clock {
  ms = 0;

  now(): Date {
    return new Date(this.ms);
  }
}

function cachedWith(api: TaggedAreaApi) {
  const clock = new FakeClock();
  return { clock, cached: new CachedAreaApi(api, new ExpiringCache(CachedAreaApi.POLICY, clock)) };
}

describe('CachedAreaApi', () => {
  it('asks once per kind, area and limit while the listing is fresh', async () => {
    const { api, listTagged } = fakeApi();
    const { cached } = cachedWith(api);
    await cached.list('assembly', 'rajasthan-jodhpur', 200);
    await cached.list('assembly', 'rajasthan-jodhpur', 200);
    await cached.list('assembly', 'rajasthan-jaipur', 200);
    await cached.list('ward', 'rajasthan-jodhpur', 200);
    expect(listTagged).toHaveBeenCalledTimes(3);
  });

  it('forgets a failed first request, so the next open tries again', async () => {
    const { api, listTagged } = fakeApi();
    listTagged.mockRejectedValueOnce(new Error('offline'));
    const { cached } = cachedWith(api);
    await expect(cached.list('assembly', 'rajasthan-jodhpur', 200)).rejects.toThrow('offline');
    await expect(cached.list('assembly', 'rajasthan-jodhpur', 200)).resolves.toMatchObject({ within: 'rajasthan-jodhpur' });
    expect(listTagged).toHaveBeenCalledTimes(2);
  });
});

describe('CachedAreaApi revalidation', () => {
  it('makes a five-minute-old listing wait for a check with its ETag, and answers with what the check brings', async () => {
    const { api, listTagged } = fakeApi();
    const { clock, cached } = cachedWith(api);
    await cached.list('assembly', 'rajasthan-jodhpur', 200);
    clock.ms = 5 * 60 * 1000;
    const newer = { ...listing('rajasthan-jodhpur'), total: 4 };
    listTagged.mockResolvedValueOnce({ value: newer, token: '"newer"' });
    expect(await cached.list('assembly', 'rajasthan-jodhpur', 200)).toEqual(newer);
    const previous = { value: listing('rajasthan-jodhpur'), token: '"rajasthan-jodhpur"' };
    expect(listTagged).toHaveBeenLastCalledWith('assembly', 'rajasthan-jodhpur', 200, previous);
  });

  it('rejects when the check of an old listing fails, so the screen shows the error, then checks again', async () => {
    const { api, listTagged } = fakeApi();
    const { clock, cached } = cachedWith(api);
    await cached.list('assembly', 'rajasthan-jodhpur', 200);
    clock.ms = 5 * 60 * 1000;
    listTagged.mockRejectedValueOnce(new Error('offline'));
    await expect(cached.list('assembly', 'rajasthan-jodhpur', 200)).rejects.toThrow('offline');
    await expect(cached.list('assembly', 'rajasthan-jodhpur', 200)).resolves.toEqual(listing('rajasthan-jodhpur'));
    expect(listTagged).toHaveBeenCalledTimes(3);
  });
});
