import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { MockAuthService } from '../src/services/MockAuthService';
import { activityRig, listed, reportIds, scanIds, scanRow, sentRow, signIn, unsentRow } from './activityRig';
import { FakeReportApi } from './FakeReportApi';
import { MemoryStore, renderApp, testServices } from './helpers';
import { MemoryReportStore } from './snapFakes';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

const LATER = '2026-10-10T05:00:00Z';

describe('Activity on an install from before this release (no list token)', () => {
  it('hides sent photos and videos made before this sign-in, then removes them on the first sync; unsent ones stay', async () => {
    const { snap } = await activityRig({ rows: [sentRow(1), unsentRow(2)], scans: [scanRow(3, true), scanRow(4, false)], clock: LATER });
    expect(snap.activity.trusted()).toBe(false);
    await snap.activity.revalidate();
    expect(reportIds(snap)).toEqual(['2'.repeat(64)]);
    expect(scanIds(snap)).toEqual(['4'.repeat(64)]);
    expect(snap.activity.trusted()).toBe(true);
  });

  it('keeps sent rows made in this sign-in, even before the server lists them', async () => {
    const { snap } = await activityRig({ rows: [sentRow(1)], scans: [scanRow(3, true)] });
    await snap.activity.revalidate();
    expect(reportIds(snap)).toEqual(['rpt_1']);
    expect(scanIds(snap)).toEqual(['3'.repeat(64)]);
  });

  it('shows no sent row in the sheet until the list is confirmed for this account', async () => {
    const api = new FakeReportApi();
    api.hold();
    const store = new MemoryReportStore();
    await store.put(sentRow(1).data);
    const services = testServices(new MemoryStore(), { api, store });
    await signIn(services.auth as MockAuthService, 'resident@example.com');
    await renderApp(<AppRoutes />, { route: '/activity', services });
    // While GET /me/reports is on its way the sheet says it is loading, never "Nothing sent yet".
    expect(await screen.findByText('Loading your reports')).toBeInTheDocument();
    expect(screen.queryByText('Waste dump')).not.toBeInTheDocument();
  });
});

describe('Activity on sign-out', () => {
  it('removes sent rows, keeps unsent photos, and stops trusting the list', async () => {
    const { snap, auth } = await activityRig({ rows: [sentRow(1), unsentRow(2)] });
    await snap.activity.revalidate();
    expect(snap.activity.trusted()).toBe(true);
    await auth.signOut();
    await waitFor(() => expect(reportIds(snap)).toEqual(['2'.repeat(64)]));
    expect(snap.activity.trusted()).toBe(false);
  });

  it('brings the account\'s reports back from the server on its next sign-in', async () => {
    const { snap, api, auth } = await activityRig({ rows: [sentRow(1)] });
    await snap.activity.revalidate();
    await auth.signOut();
    await waitFor(() => expect(snap.queue.snapshot()).toHaveLength(0));
    api.pages_ = [[listed(1)]];
    await auth.signIn('resident@example.com', 'jodhpur2026');
    await snap.activity.revalidate();
    expect(reportIds(snap)).toEqual(['rpt_1']);
    expect(snap.activity.trusted()).toBe(true);
  });

  it('never makes a new row for a withdrawn report', async () => {
    const { snap, api } = await activityRig();
    api.pages_ = [[listed(1, 'withdrawn'), listed(2)]];
    await snap.activity.revalidate();
    expect(reportIds(snap)).toEqual(['rpt_2']);
  });
});
