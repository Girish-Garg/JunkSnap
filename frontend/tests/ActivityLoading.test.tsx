import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { AuthError } from '../src/domain/AuthError';
import { MockAuthService } from '../src/services/MockAuthService';
import { activityRig, listed, reportIds, sentRow, signIn } from './activityRig';
import { FakeReportApi } from './FakeReportApi';
import { MemoryStore, renderApp, testServices } from './helpers';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

describe('Activity on a cold start', () => {
  it('shows a loading skeleton, not the empty state, while the first sync is on its way', async () => {
    const api = new FakeReportApi();
    api.pages_ = [[listed(1)]];
    const release = api.hold();
    const services = testServices(new MemoryStore(), { api });
    await signIn(services.auth as MockAuthService, 'resident@example.com');
    await renderApp(<AppRoutes />, { route: '/activity', services });
    expect(await screen.findByText('Loading your reports')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Take your first photo' })).not.toBeInTheDocument();
    release();
    expect(await screen.findByText('Waste dump')).toBeInTheDocument();
    expect(screen.queryByText('Loading your reports')).not.toBeInTheDocument();
  });

  it('trusts a list token synced moments ago for this account without asking the server again', async () => {
    const { snap, api } = await activityRig({ rows: [sentRow(1)] });
    api.pages_ = [[listed(1)]];
    await snap.activity.revalidate();
    await snap.activity.revalidate();
    expect(api.count('mine')).toBe(1);
    expect(snap.activity.state()).toEqual({ trusted: true, loading: false });
  });
});

describe('a sync still running at sign-out', () => {
  it('drops what it brought back, so the old account\'s rows and token never land', async () => {
    const { snap, api, auth, meta } = await activityRig();
    await snap.activity.settled();
    api.pages_ = [[listed(1)]];
    const release = api.hold();
    const sync = snap.activity.revalidate();
    await waitFor(() => expect(api.count('mine')).toBe(1));
    await auth.signOut();
    release();
    await sync;
    await snap.activity.settled();
    await snap.queue.load();
    expect(reportIds(snap)).toEqual([]);
    expect(snap.activity.trusted()).toBe(false);
    expect(await meta.get('activity.token')).toBe('');
  });
});

describe('refreshing statuses offline with an expired sign-in', () => {
  it('keeps the last known status instead of rejecting', async () => {
    const { snap, api } = await activityRig({ rows: [sentRow(1)] });
    vi.spyOn(api, 'status').mockRejectedValue(new AuthError('network', 'offline'));
    await expect(snap.tracker.refreshOpen()).resolves.toBeUndefined();
    expect(snap.queue.find('1'.repeat(64))?.data.status?.status).toBe('unverified');
  });

  it('reports any other failure of the Activity refresh through the error reporter', async () => {
    const services = testServices(new MemoryStore(), { api: new FakeReportApi() });
    await signIn(services.auth as MockAuthService, 'resident@example.com');
    vi.spyOn(services.snap.tracker, 'refreshOpen').mockRejectedValue(new Error('disk'));
    const report = vi.spyOn(services.errors, 'report');
    await renderApp(<AppRoutes />, { route: '/activity', services });
    await waitFor(() => expect(report).toHaveBeenCalledWith('activity', expect.any(Error)));
  });
});
