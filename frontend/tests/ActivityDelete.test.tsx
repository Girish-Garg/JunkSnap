import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { ServiceContainer } from '../src/app/ServiceContainer';
import { QueuedReport } from '../src/domain/QueuedReport';
import type { ReportStatus, ReportStatusView } from '../src/domain/ReportStatus';
import { FakeReportApi } from './FakeReportApi';
import { FakeSiteActionsApi } from './FakeSiteActionsApi';
import { MemoryStore, renderApp, testServices } from './helpers';
import { MemoryReportStore, sampleDraft } from './snapFakes';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

const NOW = new Date('2026-10-10T04:00:00Z');

// The api answers each report's status as the phone last stored it, so Activity's refresh changes nothing.
class StoredStatuses extends FakeReportApi {
  readonly #views = new Map<string, ReportStatusView>();

  constructor(views: readonly ReportStatusView[]) {
    super();
    views.forEach((each) => this.#views.set(each.report_id, each));
  }

  override async status(reportId: string): Promise<ReportStatusView> {
    const found = this.#views.get(reportId);
    return found ?? super.status(reportId);
  }
}

function sent(status: ReportStatus, siteId: string | null): QueuedReport {
  const view = { report_id: 'rpt_mine', status, site_id: siteId, blurred_url: null, updated_at: '2026-10-10T04:01:00Z' };
  return QueuedReport.capture(sampleDraft(), new ArrayBuffer(1), NOW).sent('rpt_mine').withStatus(view);
}

async function activityWith(report: QueuedReport, siteApi = new FakeSiteActionsApi()): Promise<ServiceContainer> {
  const store = new MemoryReportStore();
  await store.put(report.data);
  const api = new StoredStatuses(report.data.status ? [report.data.status] : []);
  const services = testServices(new MemoryStore(), { siteApi, store, api });
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  await renderApp(<AppRoutes />, { route: '/activity', services });
  return services;
}

const photos = () => screen.findByRole('list', { name: 'Photos' });

describe('deleting from Activity', () => {
  it('withdraws a report that backs an unverified site, then removes the row', async () => {
    const user = userEvent.setup();
    const siteApi = new FakeSiteActionsApi();
    const services = await activityWith(sent('unverified', 'site_jpr_1'), siteApi);
    await user.click(within(await photos()).getByRole('button', { name: 'Delete' }));
    expect(screen.getByText(/This also withdraws your report from its site/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));
    expect(await screen.findByText('Report withdrawn. The site is off the map.')).toBeInTheDocument();
    expect(siteApi.calls).toEqual([{ kind: 'withdraw', siteId: 'site_jpr_1', body: null }]);
    await waitFor(() => expect(services.snap.queue.snapshot()).toHaveLength(0));
  });

  it('says clearly that a verified site stays, and only hides the row', async () => {
    const user = userEvent.setup();
    const siteApi = new FakeSiteActionsApi();
    const services = await activityWith(sent('verified', 'site_jdh_1'), siteApi);
    await user.click(within(await photos()).getByRole('button', { name: 'Delete' }));
    expect(screen.getByText(/This site is verified by neighbours, so it stays on the map\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));
    await waitFor(() => expect(services.snap.queue.snapshot()).toHaveLength(0));
    expect(siteApi.calls).toEqual([]);
  });

});

describe('deleting from Activity without a site to change', () => {
  it('just removes a rejected report from this phone, and Cancel keeps it', async () => {
    const user = userEvent.setup();
    const siteApi = new FakeSiteActionsApi();
    const services = await activityWith(sent('rejected', null), siteApi);
    await user.click(within(await photos()).getByRole('button', { name: 'Delete' }));
    expect(screen.getByText("This removes it from this phone's list.")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(services.snap.queue.snapshot()).toHaveLength(1);
    await user.click(within(await photos()).getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));
    await waitFor(() => expect(services.snap.queue.snapshot()).toHaveLength(0));
    expect(siteApi.calls).toEqual([]);
  });

  it('keeps the row and says so when the withdrawal fails', async () => {
    const user = userEvent.setup();
    const siteApi = new FakeSiteActionsApi();
    siteApi.failNext('withdraw', 429, 'rate_limited');
    const services = await activityWith(sent('unverified', 'site_jpr_1'), siteApi);
    await user.click(within(await photos()).getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many withdrawals this hour.');
    expect(services.snap.queue.snapshot()).toHaveLength(1);
  });
});
