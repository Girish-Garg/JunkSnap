import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { ServiceContainer } from '../src/app/ServiceContainer';
import { QueuedReport } from '../src/domain/QueuedReport';
import type { ReportStatus } from '../src/domain/ReportStatus';
import { ReportStatuses } from '../src/domain/ReportStatus';
import { SiteListing } from '../src/domain/SiteListing';
import { MapNotice } from '../src/features/map/MapNotice';
import { ReportProgress } from '../src/features/snap/ReportProgress';
import { FakeSiteActionsApi } from './FakeSiteActionsApi';
import { MemoryStore, renderApp, testServices } from './helpers';
import { MemoryReportStore, sampleDraft } from './snapFakes';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

const NOW = new Date('2026-10-10T04:00:00Z');

// A report this phone sent that the api merged into siteId.
function sentReport(siteId: string, status: ReportStatus = 'unverified', sha = 'b'): QueuedReport {
  const view = { report_id: 'rpt_mine', status, site_id: siteId, blurred_url: null, updated_at: '2026-10-10T04:01:00Z' };
  return QueuedReport.capture(sampleDraft(sha.repeat(64)), new ArrayBuffer(1), NOW).sent('rpt_mine').withStatus(view);
}

async function signedIn(reports: readonly QueuedReport[], siteApi = new FakeSiteActionsApi()): Promise<ServiceContainer> {
  const store = new MemoryReportStore();
  await Promise.all(reports.map((report) => store.put(report.data)));
  const services = testServices(new MemoryStore(), { siteApi, store });
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  return services;
}

describe('withdraw my report', () => {
  it('asks once more, withdraws, marks the report withdrawn and confirms with a toast', async () => {
    const user = userEvent.setup();
    const api = new FakeSiteActionsApi();
    const report = sentReport('site_jpr_1');
    const services = await signedIn([report], api);
    await renderApp(<AppRoutes />, { route: '/sites/site_jpr_1', services });
    await user.click(await screen.findByRole('button', { name: 'Withdraw my report' }));
    expect(screen.getByText(/If nobody else reported it, the site leaves the map/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Yes, withdraw' }));
    expect(await screen.findByText('Report withdrawn. The site is off the map.')).toBeInTheDocument();
    expect(api.calls.filter((call) => call.kind === 'withdraw')).toEqual([{ kind: 'withdraw', siteId: 'site_jpr_1', body: null }]);
    await waitFor(() => expect(services.snap.queue.find(report.id)?.data.status?.status).toBe('withdrawn'));
  });

  it('keeps the report when the reporter changes their mind', async () => {
    const user = userEvent.setup();
    const api = new FakeSiteActionsApi();
    await renderApp(<AppRoutes />, { route: '/sites/site_jpr_1', services: await signedIn([sentReport('site_jpr_1')], api) });
    await user.click(await screen.findByRole('button', { name: 'Withdraw my report' }));
    await user.click(screen.getByRole('button', { name: 'Keep my report' }));
    expect(screen.getByRole('button', { name: 'Withdraw my report' })).toBeInTheDocument();
    expect(api.calls).toEqual([]);
  });

});

describe('withdraw my report refusals', () => {
  it('says plainly when ten people verified the site in the meantime', async () => {
    const user = userEvent.setup();
    const api = new FakeSiteActionsApi();
    api.failNext('withdraw', 409, 'site_verified');
    await renderApp(<AppRoutes />, { route: '/sites/site_jpr_1', services: await signedIn([sentReport('site_jpr_1')], api) });
    await user.click(await screen.findByRole('button', { name: 'Withdraw my report' }));
    await user.click(screen.getByRole('button', { name: 'Yes, withdraw' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ten people have verified this site, so your report stays.');
  });

  it('is not offered on a verified site, even to its reporter', async () => {
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1', services: await signedIn([sentReport('site_jdh_1')]) });
    await screen.findAllByText(/Jodhpur/);
    expect(screen.queryByRole('button', { name: 'Withdraw my report' })).toBeNull();
  });

  it('is not offered to someone with no report on the site', async () => {
    await renderApp(<AppRoutes />, { route: '/sites/site_jpr_1', services: await signedIn([sentReport('site_jdh_1')]) });
    await screen.findByRole('button', { name: "Yes, it's waste" });
    expect(screen.queryByRole('button', { name: 'Withdraw my report' })).toBeNull();
  });
});

describe('cleared vote', () => {
  it('sends a cleaned vote from the neighbour check', async () => {
    const user = userEvent.setup();
    const api = new FakeSiteActionsApi();
    await renderApp(<AppRoutes />, { route: '/sites/site_jpr_1', services: await signedIn([], api) });
    await user.click(await screen.findByRole('button', { name: "It's cleared now" }));
    await waitFor(() => expect(api.calls.map((call) => call.body)).toEqual([expect.objectContaining({ vote: 'cleaned' })]));
  });
});

describe('withdrawal rules', () => {
  it('finds only this phone’s reports that can still be withdrawn', () => {
    const reports = [sentReport('site_a'), sentReport('site_a', 'verified', 'c'), sentReport('site_b', 'unverified', 'd')];
    expect(SiteListing.mine(reports, 'site_a')).toEqual([reports[0]]);
    const mine = SiteListing.mine(reports, 'site_a');
    expect(SiteListing.canWithdraw({ verification: 'unverified', status: 'open' }, mine)).toBe(true);
    expect(SiteListing.canWithdraw({ verification: 'verified', status: 'open' }, mine)).toBe(false);
    expect(SiteListing.canWithdraw({ verification: 'unverified', status: 'removed' }, mine)).toBe(false);
    expect(SiteListing.canWithdraw({ verification: 'unverified', status: 'open' }, [])).toBe(false);
  });

  it('keeps removed, cleaned and rejected sites off the map', () => {
    expect(SiteListing.onMap({ verification: 'unverified', status: 'open' })).toBe(true);
    expect(SiteListing.onMap({ verification: 'verified', status: 'reopened' })).toBe(true);
    expect(SiteListing.onMap({ verification: 'unverified', status: 'removed' })).toBe(false);
    expect(SiteListing.onMap({ verification: 'verified', status: 'cleaned' })).toBe(false);
    expect(SiteListing.onMap({ verification: 'rejected', status: 'open' })).toBe(false);
  });

  it('shows a withdrawn report as final and Withdrawn in Activity', () => {
    const report = sentReport('site_a').withdrawn();
    expect(ReportStatuses.isFinal('withdrawn')).toBe(true);
    expect(ReportProgress.of(report)).toEqual({ key: 'withdrawn', tone: 'plain' });
  });

  it('puts the toast before every other map notice', () => {
    const calm = { online: false, failed: false, locationProblem: null, loaded: true, loadedCount: 1, shownCount: 1, clamped: false };
    expect(MapNotice.pick({ ...calm, flash: 'withdraw.done' })?.key).toBe('withdraw.done');
  });
});
