import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { SnapServices } from '../src/app/SnapServices';
import { QueuedReport } from '../src/domain/QueuedReport';
import type { ReportStatus, ReportStatusView } from '../src/domain/ReportStatus';
import { AccountKey } from '../src/services/AccountKey';
import { MockAuthService } from '../src/services/MockAuthService';
import { FakeReportApi } from './FakeReportApi';
import { MemoryStore, renderApp, testServices } from './helpers';
import { FakeClock, MemoryMetaStore, MemoryReportStore, sampleDraft, testSnapServices } from './snapFakes';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

const NOW = new Date('2026-10-10T04:00:00Z');

function listed(n: number, status: ReportStatus = 'unverified'): ReportStatusView {
  const report = { report_type: 'waste_dump', context: 'roadside', capture_mode: 'snap' as const, captured_at: '2026-10-10T03:00:00Z', sha256: `${n}`.repeat(64), gps: { lat: 26.2, lon: 73, accuracy_m: 6 } };
  return { report_id: `rpt_${n}`, status, site_id: null, blurred_url: null, updated_at: '2026-10-10T03:10:00Z', received_at: '2026-10-10T03:00:05Z', report };
}

const sentRow = (n: number) => QueuedReport.capture(sampleDraft(`${n}`.repeat(64)), new ArrayBuffer(1), NOW).sent(`rpt_${n}`).withStatus(listed(n));
const unsentRow = (n: number) => QueuedReport.capture(sampleDraft(`${n}`.repeat(64)), new ArrayBuffer(1), NOW);

async function signIn(auth: MockAuthService, email: string): Promise<void> {
  await auth.signUp(email, 'jodhpur2026');
  await auth.confirmSignUp(email, '123456');
}

async function rig(rows: readonly QueuedReport[]): Promise<{ snap: SnapServices; api: FakeReportApi; auth: MockAuthService }> {
  const store = new MemoryReportStore();
  for (const row of rows) await store.put(row.data);
  const api = new FakeReportApi();
  const auth = new MockAuthService(new MemoryStore(), 0);
  await signIn(auth, 'resident@example.com');
  return { snap: testSnapServices({ auth, api, store, clock: new FakeClock() }), api, auth };
}

describe('Activity on a shared phone', () => {
  it('trusts sent rows only after a sync for this account', async () => {
    const { snap, api } = await rig([sentRow(1)]);
    expect(snap.activity.trusted()).toBe(false);
    api.failNext('mine', 0, 'network_error');
    await snap.activity.revalidate();
    expect(snap.activity.trusted()).toBe(false);
    await snap.activity.revalidate();
    expect(snap.activity.trusted()).toBe(true);
  });

  it('hides sent rows in the sheet until the list is confirmed for this account', async () => {
    const api = new FakeReportApi();
    api.failNext('mine', 0, 'network_error');
    const store = new MemoryReportStore();
    await store.put(sentRow(1).data);
    const services = testServices(new MemoryStore(), { api, store });
    await signIn(services.auth as MockAuthService, 'resident@example.com');
    await renderApp(<AppRoutes />, { route: '/activity', services });
    expect(await screen.findByRole('button', { name: 'Take your first photo' })).toBeInTheDocument();
    expect(screen.queryByText('Waste dump')).not.toBeInTheDocument();
  });
});

describe('Activity on sign-out', () => {
  it('removes sent rows on sign-out, keeps unsent photos, and stops trusting the list', async () => {
    const { snap, auth } = await rig([sentRow(1), unsentRow(2)]);
    await snap.activity.revalidate();
    expect(snap.activity.trusted()).toBe(true);
    await auth.signOut();
    await waitFor(() => expect(snap.queue.snapshot().map((row) => row.id)).toEqual(['2'.repeat(64)]));
    expect(snap.activity.trusted()).toBe(false);
  });

  it('brings the signed-out account\'s reports back from the server on its next sign-in', async () => {
    const { snap, api, auth } = await rig([sentRow(1)]);
    await snap.activity.revalidate();
    await auth.signOut();
    await waitFor(() => expect(snap.queue.snapshot()).toHaveLength(0));
    api.pages_ = [[listed(1)]];
    await auth.signIn('resident@example.com', 'jodhpur2026');
    await snap.activity.revalidate();
    expect(snap.queue.snapshot().map((row) => row.data.report_id)).toEqual(['rpt_1']);
    expect(snap.activity.trusted()).toBe(true);
  });
});

describe('Activity merge', () => {
  it('never makes a new row for a withdrawn report', async () => {
    const { snap, api } = await rig([]);
    api.pages_ = [[listed(1, 'withdrawn'), listed(2)]];
    await snap.activity.revalidate();
    expect(snap.queue.snapshot().map((row) => row.data.report_id)).toEqual(['rpt_2']);
  });
});

describe('AccountKey', () => {
  const key = (auth: MockAuthService, meta: MemoryMetaStore) =>
    new AccountKey({ auth, subtle: crypto.subtle, meta, random: () => crypto.getRandomValues(new Uint8Array(16)) }).current();

  it('is stable on one install, differs between installs, and never holds the email', async () => {
    const auth = new MockAuthService(new MemoryStore(), 0);
    await signIn(auth, 'resident@example.com');
    const meta = new MemoryMetaStore();
    const first = await key(auth, meta);
    expect(await key(auth, meta)).toBe(first);
    expect(await key(auth, new MemoryMetaStore())).not.toBe(first);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is null when nobody is signed in', async () => {
    expect(await key(new MockAuthService(new MemoryStore(), 0), new MemoryMetaStore())).toBeNull();
  });
});
