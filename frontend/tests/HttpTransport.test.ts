import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/domain/ApiError';
import { ConditionalFetch } from '../src/services/ConditionalFetch';
import { HttpTransport } from '../src/services/HttpTransport';
import { fixedIdentity } from './snapFakes';

function recordingFetch() {
  const calls: RequestInit[] = [];
  const fetcher: typeof fetch = async (_input, init) => {
    calls.push(init ?? {});
    return init?.method === 'PUT' ? new Response(null, { status: 200 }) : Response.json({ ok: true });
  };
  return { calls, fetcher };
}

describe('HttpTransport timeouts', () => {
  it('gives every json() call a timeout signal, so a hung api call ends as a timeout', async () => {
    const { calls, fetcher } = recordingFetch();
    await new HttpTransport('https://api.test', fixedIdentity('t'), fetcher).json('/sites/site_1', { method: 'GET' });
    expect(calls[0]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('keeps a caller signal for json() and sets none for the presigned put(), whose video can take long', async () => {
    const { calls, fetcher } = recordingFetch();
    const transport = new HttpTransport('https://api.test', fixedIdentity('t'), fetcher);
    const own = new AbortController().signal;
    await transport.json('/sites/site_1', { method: 'GET', signal: own });
    await transport.put('https://bucket.test/upload', { 'Content-Type': 'video/mp4' }, new ArrayBuffer(4));
    expect(calls[0]?.signal).toBe(own);
    expect(calls[1]?.signal).toBeUndefined();
  });
});

describe('ConditionalFetch reads (#126)', () => {
  it('get the same timeout signal as json()', async () => {
    const { calls, fetcher } = recordingFetch();
    await new ConditionalFetch('https://api.test', fetcher).get('/sites/site_1', null);
    expect(calls[0]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('route failures through HttpErrors: a timeout, a lost connection and an api error code', async () => {
    const failing = (error: unknown): typeof fetch => async () => {
      throw error;
    };
    const timedOut = new ConditionalFetch('https://api.test', failing(new DOMException('signal timed out', 'TimeoutError')));
    await expect(timedOut.get('/sites/site_1', null)).rejects.toMatchObject({ status: 0, code: 'timeout' });
    const lost = new ConditionalFetch('https://api.test', failing(new TypeError('Failed to fetch')));
    await expect(lost.get('/sites/site_1', null)).rejects.toMatchObject({ status: 0, code: 'network_error' });
    const refused = new ConditionalFetch('https://api.test', async () => Response.json({ error: 'not_found', message: 'No site' }, { status: 404 }));
    const error = await refused.get('/sites/site_1', null).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: 'not_found' });
  });
});
