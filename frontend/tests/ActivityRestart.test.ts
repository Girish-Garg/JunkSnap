import { describe, expect, it } from 'vitest';
import type { QueuedScanData } from '../src/domain/QueuedScan';
import { MockAuthService } from '../src/services/MockAuthService';
import { scanIds, scanRow, sentRow, signIn } from './activityRig';
import { FakeReportApi } from './FakeReportApi';
import { MemoryStore } from './helpers';
import { FakeClock, MemoryItemStore, MemoryMetaStore, MemoryReportStore, testSnapServices } from './snapFakes';

const SIGN_IN = '2026-10-10T05:00:00Z';
const RESTART = '2026-10-10T07:00:00Z';

// One phone's disk: the session, the small values, the photo rows and the video rows survive a restart.
function phone() {
  return { session: new MemoryStore(), meta: new MemoryMetaStore(), store: new MemoryReportStore(), scanStore: new MemoryItemStore<QueuedScanData>() };
}

function start(disk: ReturnType<typeof phone>, at: string) {
  const auth = new MockAuthService(disk.session, 0);
  const { meta, store, scanStore } = disk;
  return { auth, snap: testSnapServices({ auth, api: new FakeReportApi(), meta, store, scanStore, clock: new FakeClock(at) }) };
}

describe('Activity ownership across a restart', () => {
  it('keeps a video sent after sign-in when the app restarts before Activity was ever opened', async () => {
    const disk = phone();
    const first = start(disk, SIGN_IN);
    await signIn(first.auth, 'resident@example.com');
    await first.snap.activity.settled();
    await first.snap.scans.save(scanRow(1, true, new Date('2026-10-10T05:30:00Z')));

    const second = start(disk, RESTART);
    await second.snap.activity.settled();
    await second.snap.activity.revalidate();
    await second.snap.scans.load();
    expect(scanIds(second.snap)).toEqual(['1'.repeat(64)]);
    expect(second.snap.activity.trusted()).toBe(true);
  });

  it('at sign-in, removes sent photos and videos saved before it, and keeps unsent ones', async () => {
    const disk = phone();
    await disk.store.put(sentRow(1).data);
    await disk.scanStore.put(scanRow(2, true).data);
    await disk.scanStore.put(scanRow(3, false).data);
    const { auth, snap } = start(disk, SIGN_IN);
    await signIn(auth, 'resident@example.com');
    await snap.activity.settled();
    await snap.queue.load();
    await snap.scans.load();
    expect(snap.queue.snapshot()).toHaveLength(0);
    expect(scanIds(snap)).toEqual(['3'.repeat(64)]);
  });
});
