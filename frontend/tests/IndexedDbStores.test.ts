import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { QueuedReport } from '../src/domain/QueuedReport';
import { uuidV4 } from '../src/domain/utils';
import { DeviceIdentity } from '../src/services/DeviceIdentity';
import { IndexedDbMetaStore } from '../src/services/IndexedDbMetaStore';
import { IndexedDbReportStore } from '../src/services/IndexedDbReportStore';
import { JunkSnapDb } from '../src/services/JunkSnapDb';
import { MemoryMetaStore, sampleDraft } from './snapFakes';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('IndexedDB stores', () => {
  it('keeps queued reports with their photo bytes across connections', async () => {
    const report = QueuedReport.capture(sampleDraft(), new Uint8Array([1, 2, 3]).buffer, new Date('2026-10-10T04:00:00Z'));
    await new IndexedDbReportStore(new JunkSnapDb()).put(report.data);
    const rows = await new IndexedDbReportStore(new JunkSnapDb()).all();
    expect(rows).toHaveLength(1);
    expect(new Uint8Array(rows[0]?.photo ?? new ArrayBuffer(0))).toEqual(new Uint8Array([1, 2, 3]));
    await new IndexedDbReportStore(new JunkSnapDb()).delete(report.id);
    expect(await new IndexedDbReportStore(new JunkSnapDb()).all()).toHaveLength(0);
  });

  it('makes the device token once and reads the same one after a reload', async () => {
    const random = () => crypto.getRandomValues(new Uint8Array(16));
    const first = await new DeviceIdentity(new IndexedDbMetaStore(new JunkSnapDb()), random).token();
    const again = await new DeviceIdentity(new IndexedDbMetaStore(new JunkSnapDb()), random).token();
    expect(first).toMatch(V4);
    expect(again).toBe(first);
  });

  it('replaces a stored token that is not a UUID v4', async () => {
    const meta = new MemoryMetaStore();
    meta.values.set('device_token', 'not-a-uuid');
    const token = await new DeviceIdentity(meta, () => new Uint8Array(16).fill(255)).token();
    expect(token).toBe(uuidV4(new Uint8Array(16).fill(255)));
    expect(token).toMatch(V4);
  });
});
