import { describe, expect, it } from 'vitest';
import { HttpReportApi } from '../src/services/HttpReportApi';
import { DEVICE_TOKEN, fixedIdentity, sampleDraft } from './snapFakes';

interface Sent {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

function recordingFetch(status: number, body: unknown, sent: Sent[] = []): typeof fetch {
  return async (input, init) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    sent.push({ url: String(input), method: init?.method ?? 'GET', headers, body: init?.body });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
}

const PRESIGN = { purpose: 'report', content_type: 'image/jpeg', sha256: 'a'.repeat(64), device_token: DEVICE_TOKEN } as const;
const UPLOAD = {
  upload_id: 'upl_1',
  upload_url: 'https://bucket.s3.ap-south-1.amazonaws.com/reports/upl_1.jpg?X-Amz=1',
  headers: { 'Content-Type': 'image/jpeg', 'x-amz-checksum-sha256': 'abc=' },
  expires_at: '2026-10-10T04:05:00Z',
};

describe('HttpReportApi requests', () => {
  it('sends the Cognito ID token as a bearer token and the device token', async () => {
    const sent: Sent[] = [];
    const api = new HttpReportApi('https://api.test/', fixedIdentity('id-token'), recordingFetch(200, UPLOAD, sent));
    await api.presign(PRESIGN);
    expect(sent[0]).toMatchObject({ url: 'https://api.test/uploads/presign', method: 'POST' });
    expect(sent[0]?.headers).toMatchObject({ Authorization: 'Bearer id-token', 'X-Device-Token': DEVICE_TOKEN, 'Content-Type': 'application/json' });
    expect(JSON.parse(String(sent[0]?.body))).toEqual(PRESIGN);
  });

  it('posts the report body as given and returns the 202 body', async () => {
    const sent: Sent[] = [];
    const accepted = { report_id: 'rpt_1', status: 'queued' };
    const api = new HttpReportApi('https://api.test', fixedIdentity('id-token'), recordingFetch(202, accepted, sent));
    const upload = { ...sampleDraft(), upload_id: 'upl_1', capture_mode: 'snap', device_token: DEVICE_TOKEN } as const;
    await expect(api.submit(upload)).resolves.toEqual(accepted);
    expect(sent[0]?.url).toBe('https://api.test/reports');
    expect(JSON.parse(String(sent[0]?.body))).toEqual(upload);
  });
});

describe('HttpReportApi photo and status', () => {
  it('PUTs the photo to S3 with exactly the presigned headers', async () => {
    const sent: Sent[] = [];
    const api = new HttpReportApi('https://api.test', fixedIdentity('id-token'), recordingFetch(200, {}, sent));
    const photo = new TextEncoder().encode('jpeg').buffer;
    await api.putPhoto(UPLOAD, photo);
    expect(sent[0]).toEqual({ url: UPLOAD.upload_url, method: 'PUT', headers: UPLOAD.headers, body: photo });
  });

  it('reads a status with the device token only when signed out', async () => {
    const sent: Sent[] = [];
    const view = { report_id: 'rpt_1', status: 'queued', site_id: null, blurred_url: null, updated_at: '2026-10-10T04:00:00Z' };
    const api = new HttpReportApi('https://api.test', fixedIdentity(null), recordingFetch(200, view, sent));
    await expect(api.status('rpt_1')).resolves.toEqual(view);
    expect(sent[0]?.headers).toMatchObject({ 'X-Device-Token': DEVICE_TOKEN });
    expect(sent[0]?.headers).not.toHaveProperty('Authorization');
  });
});

describe('HttpReportApi listing', () => {
  it('lists the signed-in user\'s reports 50 at a time, passing the cursor back', async () => {
    const sent: Sent[] = [];
    const page = { reports: [], next_cursor: null };
    const api = new HttpReportApi('https://api.test', fixedIdentity('id-token'), recordingFetch(200, page, sent));
    await expect(api.mine(null)).resolves.toEqual(page);
    await api.mine('eyJrIjoxfQ');
    expect(sent.map((each) => each.url)).toEqual(['https://api.test/me/reports?limit=50', 'https://api.test/me/reports?limit=50&cursor=eyJrIjoxfQ']);
    expect(sent[0]?.headers).toMatchObject({ Authorization: 'Bearer id-token' });
  });
});

describe('HttpReportApi failures', () => {
  it('maps S3 and api failures to ApiError codes', async () => {
    const s3 = new HttpReportApi('https://api.test', fixedIdentity(), recordingFetch(403, {}));
    await expect(s3.putPhoto(UPLOAD, new ArrayBuffer(1))).rejects.toMatchObject({ status: 403, code: 'upload_refused' });
    const limited = new HttpReportApi('https://api.test', fixedIdentity(), recordingFetch(429, { error: 'rate_limited', message: 'Slow down' }));
    await expect(limited.presign(PRESIGN)).rejects.toMatchObject({ status: 429, code: 'rate_limited' });
  });

  it('maps a dropped connection to network_error', async () => {
    const offline = new HttpReportApi('https://api.test', fixedIdentity(), async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(offline.status('rpt_1')).rejects.toMatchObject({ status: 0, code: 'network_error' });
  });
});

describe('HttpReportApi reporter confirmation (contracts v1.16)', () => {
  it('POSTs only {"sure": ...} with the bearer and device tokens, and returns the report status', async () => {
    const sent: Sent[] = [];
    const view = { report_id: 'rpt_1', status: 'processing', site_id: null, blurred_url: null, updated_at: '2026-10-11T10:00:00Z', confirmation: null };
    const api = new HttpReportApi('https://api.test/', fixedIdentity('id-token'), recordingFetch(200, view, sent));
    await expect(api.confirm('rpt_1', { sure: true })).resolves.toEqual(view);
    await api.confirm('rpt_1', { sure: false });
    expect(sent[0]).toMatchObject({ url: 'https://api.test/reports/rpt_1/confirm', method: 'POST' });
    expect(sent[0]?.headers).toMatchObject({ Authorization: 'Bearer id-token', 'X-Device-Token': DEVICE_TOKEN, 'Content-Type': 'application/json' });
    expect(JSON.parse(String(sent[0]?.body))).toEqual({ sure: true });
    expect(JSON.parse(String(sent[1]?.body))).toEqual({ sure: false });
  });

  it('maps a closed question and the hourly limit to their error codes', async () => {
    const closed = new HttpReportApi('https://api.test', fixedIdentity('id-token'), recordingFetch(409, { error: 'confirmation_closed', message: 'Closed' }));
    await expect(closed.confirm('rpt_1', { sure: true })).rejects.toMatchObject({ status: 409, code: 'confirmation_closed' });
    const limited = new HttpReportApi('https://api.test', fixedIdentity('id-token'), recordingFetch(429, { error: 'rate_limited', message: 'Slow down' }));
    await expect(limited.confirm('rpt_1', { sure: false })).rejects.toMatchObject({ status: 429, code: 'rate_limited' });
  });
});
