import { describe, expect, it } from 'vitest';
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
