import { describe, expect, it, vi } from 'vitest';
import type { Clock } from '../src/services/Clock';
import { ExpiringCache, type CacheLoader, type CachePolicy, type Tagged } from '../src/services/ExpiringCache';

class FakeClock implements Clock {
  ms = 0;

  now(): Date {
    return new Date(this.ms);
  }
}

const BLOCK: CachePolicy = { ttlMs: 1000, staleWhileRevalidate: false, maxEntries: 10 };
const SWR: CachePolicy = { ...BLOCK, staleWhileRevalidate: true };
const OFFLINE = new Error('offline');

// Answers the values in turn, each tagged with itself; the last one repeats.
function loader(values: readonly string[]) {
  let call = 0;
  return vi.fn<CacheLoader<string>>(async () => {
    const value = values[Math.min(call, values.length - 1)] ?? 'none';
    call += 1;
    return { value, token: `"${value}"` };
  });
}

const steady = () => vi.fn<CacheLoader<string>>(async (): Promise<Tagged<string>> => ({ value: 'a', token: null }));

function setUp(policy: CachePolicy) {
  const clock = new FakeClock();
  return { clock, cache: new ExpiringCache<string>(policy, clock) };
}

describe('ExpiringCache freshness', () => {
  it('answers a fresh copy at once, without asking again', async () => {
    const { clock, cache } = setUp(BLOCK);
    const load = loader(['a', 'b']);
    expect(await cache.read({ key: 'k', load })).toEqual({ value: 'a', stale: false, error: null });
    clock.ms = 999;
    expect(await cache.read({ key: 'k', load })).toEqual({ value: 'a', stale: false, error: null });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('serves an old copy at once and refreshes it in the background when stale-while-revalidate', async () => {
    const { clock, cache } = setUp(SWR);
    const load = loader(['a', 'b']);
    await cache.get({ key: 'k', load });
    clock.ms = 1000;
    expect(await cache.read({ key: 'k', load })).toEqual({ value: 'a', stale: true, error: null });
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(load).toHaveBeenLastCalledWith({ value: 'a', token: '"a"' });
    await vi.waitFor(async () => expect(await cache.read({ key: 'k', load })).toEqual({ value: 'b', stale: false, error: null }));
  });

  it('waits for the refresh of an expired copy when blocking', async () => {
    const { clock, cache } = setUp(BLOCK);
    const load = loader(['a', 'b']);
    await cache.get({ key: 'k', load });
    clock.ms = 1000;
    expect(await cache.read({ key: 'k', load })).toEqual({ value: 'b', stale: false, error: null });
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('ExpiringCache tokens', () => {
  it('fetches again when the copy carries another token than the caller expects, even while fresh', async () => {
    const { cache } = setUp(BLOCK);
    const first = vi.fn<CacheLoader<string>>(async () => ({ value: 'v1 points', token: 'v1' }));
    const load = vi.fn<CacheLoader<string>>(async () => ({ value: 'v2 points', token: 'v2' }));
    expect(await cache.get({ key: 'labels', token: 'v1', load: first })).toBe('v1 points');
    expect(await cache.get({ key: 'labels', token: 'v1', load })).toBe('v1 points');
    expect(await cache.get({ key: 'labels', token: 'v2', load })).toBe('v2 points');
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(null);
  });
});

describe('ExpiringCache failures', () => {
  it('keeps the old copy with an error flag when a refresh fails, and tries again next time', async () => {
    const { clock, cache } = setUp(BLOCK);
    const load = steady();
    await cache.get({ key: 'k', load });
    clock.ms = 5000;
    load.mockRejectedValueOnce(OFFLINE);
    expect(await cache.read({ key: 'k', load })).toEqual({ value: 'a', stale: true, error: OFFLINE });
    expect(await cache.read({ key: 'k', load })).toEqual({ value: 'a', stale: false, error: null });
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('flags a failed background refresh on the next read', async () => {
    const { clock, cache } = setUp(SWR);
    const load = steady();
    await cache.get({ key: 'k', load });
    clock.ms = 5000;
    load.mockRejectedValueOnce(OFFLINE);
    await cache.read({ key: 'k', load });
    const hang: CacheLoader<string> = () => new Promise(() => undefined);
    await vi.waitFor(async () => expect((await cache.read({ key: 'k', load: hang })).error).toBe(OFFLINE));
  });
});

describe('ExpiringCache first fetch', () => {
  it('rejects when nothing is cached and the first fetch fails, keeping nothing', async () => {
    const { cache } = setUp(SWR);
    const load = steady();
    load.mockRejectedValueOnce(OFFLINE);
    await expect(cache.get({ key: 'k', load })).rejects.toThrow('offline');
    await expect(cache.get({ key: 'k', load })).resolves.toBe('a');
  });
});

const NO_TTL: CachePolicy = { ttlMs: 0, staleWhileRevalidate: false, maxEntries: 10 };

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('ExpiringCache writes during a read', () => {
  it('with no TTL, never lets a read made after a write join a read that started before it', async () => {
    const { cache } = setUp(NO_TTL);
    const before = deferred<Tagged<string>>();
    const load = vi.fn<CacheLoader<string>>().mockReturnValueOnce(before.promise).mockResolvedValueOnce({ value: 'after vote', token: '"2"' });
    const early = cache.get({ key: 'site', load });
    const late = cache.get({ key: 'site', load });
    expect(await late).toBe('after vote');
    before.resolve({ value: 'before vote', token: '"1"' });
    expect(await early).toBe('before vote');
    const offline = vi.fn<CacheLoader<string>>().mockRejectedValue(OFFLINE);
    expect(await cache.read({ key: 'site', load: offline })).toEqual({ value: 'after vote', stale: true, error: OFFLINE });
  });

  it('keeps nothing from a read already on its way when the key is forgotten after a write', async () => {
    const { cache } = setUp(BLOCK);
    const before = deferred<Tagged<string>>();
    const early = cache.get({ key: 'site', load: () => before.promise });
    cache.forget('site');
    before.resolve({ value: 'before vote', token: '"1"' });
    expect(await early).toBe('before vote');
    const load = vi.fn<CacheLoader<string>>(async () => ({ value: 'after vote', token: '"2"' }));
    expect(await cache.get({ key: 'site', load })).toBe('after vote');
    expect(load).toHaveBeenCalledWith(null);
  });
});

describe('ExpiringCache keys', () => {
  it('shares one request between callers of the same key', async () => {
    const { cache } = setUp(BLOCK);
    const load = loader(['a']);
    expect(await Promise.all([cache.get({ key: 'k', load }), cache.get({ key: 'k', load })])).toEqual(['a', 'a']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('drops the oldest keys beyond its size, and forgets a key on request', async () => {
    const { cache } = setUp({ ...BLOCK, maxEntries: 2 });
    const load = loader(['a']);
    for (const key of ['one', 'two', 'three']) await cache.get({ key, load });
    await cache.get({ key: 'one', load });
    expect(load).toHaveBeenCalledTimes(4);
    cache.forget('three');
    await cache.get({ key: 'three', load });
    expect(load).toHaveBeenCalledTimes(5);
  });
});
