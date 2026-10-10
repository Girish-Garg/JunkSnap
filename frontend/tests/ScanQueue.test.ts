import { describe, expect, it } from 'vitest';
import scanSchema from '../../contracts/schemas/scan_session.schema.json';
import type { QueuedScanData } from '../src/domain/QueuedScan';
import type { ScanDraft, ScanSession } from '../src/domain/ScanUpload';
import { QueueLock } from '../src/services/QueueLock';
import { ScanQueue } from '../src/services/ScanQueue';
import { ScanSender } from '../src/services/ScanSender';
import { ScanTracker } from '../src/services/ScanTracker';
import { FakeScanApi } from './scanFakes';
import { DEVICE_TOKEN, FakeClock, fixedIdentity, MemoryItemStore } from './snapFakes';

const VIDEO = new TextEncoder().encode('video').buffer;

function draft(sha = 'c'.repeat(64)): ScanDraft {
  const gps_track = [0, 900, 1800, 2700, 3600, 4500, 5400].map((t_ms) => ({ t_ms, lat: 26.26 + t_ms / 1e7, lon: 73.0, accuracy_m: 8 }));
  return {
    report_type: 'waste_dump', context: 'roadside', started_at: '2026-10-10T04:00:00.000Z', ended_at: '2026-10-10T04:00:06.000Z',
    duration_ms: 6000, content_type: 'video/webm', video_sha256: sha, size_bytes: 5, gps_track,
  };
}

function setup(idToken: string | null = 'id-token') {
  const api = new FakeScanApi();
  const clock = new FakeClock();
  const store = new MemoryItemStore<QueuedScanData>();
  const queue = new ScanQueue({ store, sender: new ScanSender(api, fixedIdentity(idToken), clock), clock, lock: new QueueLock(undefined) });
  return { api, queue };
}

/** The parts of scan_session.schema.json a JSON check would catch: no extra fields, all required ones, patterns. */
function expectMatchesSchema(session: ScanSession) {
  const properties = scanSchema.properties as Record<string, { pattern?: string }>;
  expect(Object.keys(session).every((key) => key in properties)).toBe(true);
  expect(scanSchema.required.every((key) => key in session)).toBe(true);
  for (const key of ['scan_id', 'device_token', 'video_key', 'video_sha256'] as const) {
    expect(session[key]).toMatch(new RegExp(properties[key]?.pattern ?? '$^'));
  }
  const itemKeys = Object.keys(scanSchema.properties.gps_track.items.properties);
  expect(session.gps_track.every((fix) => Object.keys(fix).every((key) => itemKeys.includes(key)))).toBe(true);
  expect(session.gps_track.every((fix) => Number.isInteger(fix.t_ms))).toBe(true);
}

describe('ScanQueue sends a recording', () => {
  it('presigns with the video facts, PUTs, then posts a session that matches the schema', async () => {
    const { api, queue } = setup();
    const added = await queue.add(draft(), VIDEO);
    await queue.flush();
    expect(api.calls.map((call) => call.kind)).toEqual(['presign', 'put', 'submit']);
    expect(api.bodies('presign')[0]).toEqual({ content_type: 'video/webm', sha256: 'c'.repeat(64), size_bytes: 5, duration_ms: 6000, device_token: DEVICE_TOKEN });
    const session = api.bodies('submit')[0] as ScanSession;
    expectMatchesSchema(session);
    expect(session).toMatchObject({ scan_id: 'scn_test_1', video_key: 'scans/scn_test_1.webm', duration_ms: 6000 });
    expect(session).not.toHaveProperty('user_id');
    expect(queue.find(added.id)?.data).toMatchObject({ stage: 'sent', scan_id: 'scn_test_1', video: null });
  });
});

describe('ScanQueue holds and refuses', () => {
  it('queues one video once and holds it until there is a token', async () => {
    const { api, queue } = setup(null);
    await queue.add(draft(), VIDEO);
    await queue.add(draft(), VIDEO);
    await queue.flush();
    expect(queue.snapshot()).toHaveLength(1);
    expect(api.calls).toEqual([]);
    expect(queue.snapshot()[0]?.data.problem).toBe('sign_in');
  });

  it('marks a scan_too_large refusal as failed', async () => {
    const { api, queue } = setup();
    api.failNext('presign', 400, 'scan_too_large');
    const added = await queue.add(draft(), VIDEO);
    await queue.flush();
    expect(queue.find(added.id)?.data.stage).toBe('failed');
  });
});

describe('ScanTracker', () => {
  it('keeps the worker result: report ids and frame counts', async () => {
    const { api, queue } = setup();
    const added = await queue.add(draft(), VIDEO);
    await queue.flush();
    await new ScanTracker(api, queue).refreshOpen();
    expect(queue.find(added.id)?.data.status).toMatchObject({ status: 'done', frames: { sampled: 8 } });
    expect(queue.find(added.id)?.data.status?.report_ids).toHaveLength(6);
  });
});
