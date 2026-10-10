import { describe, expect, it, vi } from 'vitest';
import type { AreaListing } from '../src/domain/AreaListing';
import type { AreaApi } from '../src/services/AreaApi';
import { CachedAreaApi } from '../src/services/CachedAreaApi';

const listing = (within: string): AreaListing => ({ kind: 'assembly', within, total: 0, limit: 200, areas: [] });

function fakeApi() {
  const list = vi.fn(async (_kind: string, within: string) => listing(within));
  const api = { list, scores: vi.fn(), crawl: vi.fn() } as unknown as AreaApi;
  return { api, list };
}

describe('CachedAreaApi', () => {
  it('asks once per kind, area and limit while the listing is fresh', async () => {
    const { api, list } = fakeApi();
    const cached = new CachedAreaApi(api, () => 0);
    await cached.list('assembly', 'rajasthan-jodhpur', 200);
    await cached.list('assembly', 'rajasthan-jodhpur', 200);
    await cached.list('assembly', 'rajasthan-jaipur', 200);
    await cached.list('ward', 'rajasthan-jodhpur', 200);
    expect(list).toHaveBeenCalledTimes(3);
  });

  it('asks again once the listing is five minutes old', async () => {
    const { api, list } = fakeApi();
    let now = 0;
    const cached = new CachedAreaApi(api, () => now);
    await cached.list('assembly', 'rajasthan-jodhpur', 200);
    now = 5 * 60 * 1000;
    await cached.list('assembly', 'rajasthan-jodhpur', 200);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('forgets a failed request, so the next open tries again', async () => {
    const { api, list } = fakeApi();
    list.mockRejectedValueOnce(new Error('offline'));
    const cached = new CachedAreaApi(api, () => 0);
    await expect(cached.list('assembly', 'rajasthan-jodhpur', 200)).rejects.toThrow('offline');
    await expect(cached.list('assembly', 'rajasthan-jodhpur', 200)).resolves.toMatchObject({ within: 'rajasthan-jodhpur' });
    expect(list).toHaveBeenCalledTimes(2);
  });
});
