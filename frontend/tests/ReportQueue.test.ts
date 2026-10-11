import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/domain/ApiError';
import type { ReportUpload } from '../src/domain/ReportUpload';
import { QueueLock } from '../src/services/QueueLock';
import { ReportQueue } from '../src/services/ReportQueue';
import { ReportSender } from '../src/services/ReportSender';
import { ReportTracker } from '../src/services/ReportTracker';
import { RetryPolicy } from '../src/services/RetryPolicy';
import { FakeReportApi } from './FakeReportApi';
import { DEVICE_TOKEN, FakeClock, fixedIdentity, MemoryReportStore, sampleDraft } from './snapFakes';

const PHOTO = new TextEncoder().encode('jpeg').buffer;

function setup(store = new MemoryReportStore(), idToken: string | null = 'id-token') {
  const api = new FakeReportApi();
  const clock = new FakeClock();
  const sender = new ReportSender(api, fixedIdentity(idToken), clock);
  const queue = new ReportQueue({ store, sender, clock, lock: new QueueLock(undefined) });
  return { api, clock, store, queue };
}

describe('ReportQueue sends a capture', () => {
  it('saves first, then presigns, PUTs and posts the report with the same upload id', async () => {
    const { api, queue, store } = setup();
    const added = await queue.add(sampleDraft(), PHOTO);
    expect(store.rows.get(added.id)?.photo).toBe(PHOTO);
    await queue.flush();
    expect(api.calls.map((call) => call.kind)).toEqual(['presign', 'put', 'submit']);
    expect(api.bodies('presign')[0]).toEqual({ purpose: 'report', content_type: 'image/jpeg', sha256: 'a'.repeat(64), device_token: DEVICE_TOKEN });
    const upload = api.bodies('submit')[0] as ReportUpload;
    expect(upload).toMatchObject({ upload_id: 'upl_test_1', capture_mode: 'snap', device_token: DEVICE_TOKEN, context: 'vacant_plot' });
    expect(upload).not.toHaveProperty('user_id');
    expect(queue.find(added.id)?.data).toMatchObject({ stage: 'sent', report_id: 'rpt_test_1', photo: null, problem: null });
  });

  it('keeps one entry for the same photo added twice', async () => {
    const { api, queue } = setup();
    await queue.add(sampleDraft(), PHOTO);
    await queue.add(sampleDraft(), PHOTO);
    await queue.flush();
    expect(queue.snapshot()).toHaveLength(1);
    expect(api.count('submit')).toBe(1);
  });
});

describe('ReportQueue and sign-in', () => {
  it('keeps captures on the phone until there is an ID token', async () => {
    const { api, queue } = setup(new MemoryReportStore(), null);
    const added = await queue.add(sampleDraft(), PHOTO);
    await queue.flush();
    expect(api.calls).toEqual([]);
    expect(queue.find(added.id)?.data).toMatchObject({ stage: 'saved', problem: 'sign_in' });
  });

  it('waits for sign-in when a refreshed token still gets 401, and sends after a retry', async () => {
    const { api, clock, queue } = setup();
    api.failNext('presign', 401, 'unauthorized');
    api.failNext('presign', 401, 'unauthorized');
    const added = await queue.add(sampleDraft(), PHOTO);
    await queue.flush();
    clock.advance(3_600_000);
    await queue.flush();
    expect(queue.find(added.id)?.data).toMatchObject({ stage: 'saved', problem: 'sign_in' });
    await queue.retry((report) => report.data.problem === 'sign_in');
    expect(queue.find(added.id)?.data.stage).toBe('sent');
  });
});

describe('ReportQueue offline', () => {
  it('waits offline, then retries the POST with the same upload id', async () => {
    const { api, clock, queue } = setup();
    api.failNext('submit', 0, 'network_error');
    const added = await queue.add(sampleDraft(), PHOTO);
    await queue.flush();
    expect(queue.find(added.id)?.data).toMatchObject({ stage: 'uploaded', problem: 'offline' });
    clock.advance(31_000);
    await queue.flush();
    const ids = api.bodies('submit').map((body) => (body as ReportUpload).upload_id);
    expect(ids).toEqual(['upl_test_1', 'upl_test_1']);
    expect(api.count('presign')).toBe(1);
    expect(queue.find(added.id)?.data.stage).toBe('sent');
  });

  it('sends what a previous visit saved', async () => {
    const store = new MemoryReportStore();
    const offline = setup(store);
    offline.api.failNext('presign', 0, 'network_error');
    await offline.queue.add(sampleDraft(), PHOTO);
    await offline.queue.flush();
    const reopened = setup(store);
    reopened.clock.advance(60_000);
    await reopened.queue.flush();
    expect(reopened.api.count('submit')).toBe(1);
    expect(reopened.queue.snapshot()[0]?.data.stage).toBe('sent');
  });
});

describe('ReportQueue refusals', () => {
  it('presigns again when S3 refuses the PUT', async () => {
    const { api, queue } = setup();
    api.failNext('put', 403, 'upload_refused');
    const added = await queue.add(sampleDraft(), PHOTO);
    await queue.flush();
    expect(api.count('presign')).toBe(2);
    expect((api.bodies('submit')[0] as ReportUpload).upload_id).toBe('upl_test_2');
    expect(queue.find(added.id)?.data.stage).toBe('sent');
  });

  it('marks a report the api refuses as failed and moves on to the next one', async () => {
    const { api, queue } = setup();
    api.failNext('submit', 400, 'bad_request');
    const first = await queue.add(sampleDraft('a'.repeat(64)), PHOTO);
    const second = await queue.add(sampleDraft('b'.repeat(64)), PHOTO);
    await queue.flush();
    expect(queue.find(first.id)?.data.stage).toBe('failed');
    expect(queue.find(second.id)?.data.stage).toBe('sent');
  });
});

describe('ReportTracker and RetryPolicy', () => {
  it('stores the server status of a sent report', async () => {
    const { api, queue } = setup();
    const added = await queue.add(sampleDraft(), PHOTO);
    await queue.flush();
    api.status_ = 'verified';
    await new ReportTracker(api, queue).refreshOpen();
    expect(queue.find(added.id)?.data.status).toMatchObject({ status: 'verified', site_id: 'site_test' });
    expect(api.bodies('status')).toEqual(['rpt_test_1']);
  });

  it('backs off on server errors and never retries a refused report by timer', () => {
    const now = new Date('2026-10-10T04:00:00Z');
    expect(RetryPolicy.retryAt('server', 3, now)?.toISOString()).toBe('2026-10-10T04:02:00.000Z');
    expect(RetryPolicy.retryAt('refused', 1, now)).toBeNull();
    expect(RetryPolicy.retryAt('sign_in', 1, now)).toBeNull();
  });

  it('backs a timed-out request off like a server error, not every 30 s like a lost connection', () => {
    expect(RetryPolicy.problemOf(new ApiError(0, 'timeout', 'Upload failed: TimeoutError'))).toBe('server');
    expect(RetryPolicy.problemOf(new ApiError(0, 'network_error', 'Upload failed: TypeError'))).toBe('offline');
  });
});
