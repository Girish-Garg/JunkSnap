import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { QueuedReport } from '../src/domain/QueuedReport';
import type { ReportStatus, ReportStatusView } from '../src/domain/ReportStatus';
import { MockAuthService } from '../src/services/MockAuthService';
import type { SnapServices } from '../src/app/SnapServices';
import { FakeReportApi } from './FakeReportApi';
import { MemoryStore, renderApp, testServices } from './helpers';
import { FakeClock, MemoryMetaStore, MemoryReportStore, sampleDraft, testSnapServices } from './snapFakes';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

const NOW = new Date('2026-10-10T04:00:00Z');

// One report as GET /me/reports lists it; its row id is the photo's sha256.
function listed(n: number, status: ReportStatus = 'unverified', updated = '2026-10-10T03:10:00Z'): ReportStatusView {
  const report = { report_type: 'waste_dump', context: 'roadside', capture_mode: 'snap' as const, captured_at: '2026-10-10T03:00:00Z', sha256: `${n}`.repeat(64), gps: { lat: 26.2, lon: 73, accuracy_m: 6 } };
  return { report_id: `rpt_${n}`, status, site_id: null, blurred_url: null, updated_at: updated, received_at: '2026-10-10T03:00:05Z', report };
}

// A row this phone sent itself, with the last status it read.
function sentRow(n: number, synced: boolean): QueuedReport {
  const row = QueuedReport.capture(sampleDraft(`${n}`.repeat(64)), new ArrayBuffer(1), NOW).sent(`rpt_${n}`);
  return synced ? row.synced(listed(n), NOW) : row.withStatus(listed(n));
}

interface Rig {
  readonly snap: SnapServices;
  readonly api: FakeReportApi;
  readonly auth: MockAuthService;
  readonly clock: FakeClock;
  readonly store: MemoryReportStore;
}

async function rig(rows: readonly QueuedReport[] = [], meta = new MemoryMetaStore()): Promise<Rig> {
  const store = new MemoryReportStore();
  for (const row of rows) await store.put(row.data);
  const api = new FakeReportApi();
  const auth = new MockAuthService(new MemoryStore(), 0);
  const clock = new FakeClock();
  await signIn(auth, 'resident@example.com');
  return { snap: testSnapServices({ auth, api, store, clock, meta }), api, auth, clock, store };
}

async function signIn(auth: MockAuthService, email: string): Promise<void> {
  await auth.signUp(email, 'jodhpur2026');
  await auth.confirmSignUp(email, '123456');
}

const ids = (snap: SnapServices) => snap.queue.snapshot().map((row) => row.data.report_id).sort();

describe('Activity after signing in again or on a new phone', () => {
  it('brings back every page of the user\'s reports from the server', async () => {
    const { snap, api } = await rig();
    api.pages_ = [[listed(1), listed(2)], [listed(3, 'verified')]];
    await snap.activity.revalidate();
    expect(ids(snap)).toEqual(['rpt_1', 'rpt_2', 'rpt_3']);
    expect(api.bodies('mine')).toEqual([null, '1']);
    expect(snap.queue.find('3'.repeat(64))?.data.status?.status).toBe('verified');
  });

  it('shows the restored reports in the Activity sheet', async () => {
    const api = new FakeReportApi();
    api.pages_ = [[listed(1)]];
    const services = testServices(new MemoryStore(), { api });
    await signIn(services.auth as MockAuthService, 'resident@example.com');
    await renderApp(<AppRoutes />, { route: '/activity', services });
    const photos = await screen.findByRole('list', { name: 'Photos' });
    expect(within(photos).getByText('Waste dump')).toBeInTheDocument();
  });

  it('never asks the server while nobody is signed in', async () => {
    const { snap, api, auth } = await rig();
    await auth.signOut();
    await snap.activity.revalidate();
    expect(api.count('mine')).toBe(0);
  });
});

describe('Activity freshness token', () => {
  let r: Rig;

  beforeEach(async () => {
    r = await rig();
    r.api.pages_ = [[listed(1)]];
    await r.snap.activity.revalidate();
  });

  it('shows the phone\'s copy without asking again inside the 60 s TTL', async () => {
    r.clock.advance(59_000);
    await r.snap.activity.revalidate();
    expect(r.api.count('mine')).toBe(1);
  });

  it('asks again once the token is older than the TTL, and replaces a row whose updated_at changed', async () => {
    r.api.pages_ = [[listed(1, 'verified', '2026-10-10T03:50:00Z')]];
    r.clock.advance(60_000);
    await r.snap.activity.revalidate();
    expect(r.api.count('mine')).toBe(2);
    expect(r.snap.queue.snapshot()[0]?.data.status?.status).toBe('verified');
  });
});

describe('Activity freshness token, another account or offline', () => {
  let r: Rig;

  beforeEach(async () => {
    r = await rig();
    r.api.pages_ = [[listed(1)]];
    await r.snap.activity.revalidate();
  });

  it('asks again at once for another account, and drops the other account\'s rows', async () => {
    await r.auth.signOut();
    await signIn(r.auth, 'neighbour@example.com');
    r.api.pages_ = [[listed(7)]];
    await r.snap.activity.revalidate();
    expect(ids(r.snap)).toEqual(['rpt_7']);
  });

  it('keeps the phone\'s copy when the server cannot be reached, and tries again next time', async () => {
    r.clock.advance(60_000);
    r.api.failNext('mine', 0, 'offline');
    await r.snap.activity.revalidate();
    expect(ids(r.snap)).toEqual(['rpt_1']);
    await r.snap.activity.revalidate();
    expect(r.api.count('mine')).toBe(3);
  });
});

describe('merging the server list with the phone', () => {
  it('drops a row the server listed before but no longer has, and keeps one it never listed', async () => {
    const { snap, api, clock } = await rig([sentRow(1, false), sentRow(2, false)]);
    api.pages_ = [[listed(1)]];
    await snap.activity.revalidate();
    api.pages_ = [[]];
    clock.advance(60_000);
    await snap.activity.revalidate();
    expect(ids(snap)).toEqual(['rpt_2']);
  });

  it('keeps a photo still waiting to send, and never shows a listed report twice', async () => {
    const pending = QueuedReport.capture(sampleDraft('9'.repeat(64)), new ArrayBuffer(1), NOW);
    const { snap, api } = await rig([pending, sentRow(1, false)]);
    api.pages_ = [[listed(1, 'verified')]];
    await snap.activity.revalidate();
    expect(snap.queue.snapshot()).toHaveLength(2);
    expect(snap.queue.find('9'.repeat(64))?.isPending()).toBe(true);
    expect(snap.queue.find('1'.repeat(64))?.data.status?.status).toBe('verified');
  });
});

describe('merging after a delete', () => {
  it('never brings back a report deleted from Activity', async () => {
    const { snap, api } = await rig([sentRow(1, true)]);
    await snap.queue.load();
    const row = snap.queue.snapshot()[0];
    if (!row) throw new Error('no row');
    await snap.remover.removeReport(row.withStatus(listed(1, 'rejected')));
    api.pages_ = [[listed(1, 'rejected')]];
    await snap.activity.revalidate();
    expect(snap.queue.snapshot()).toHaveLength(0);
  });
});
