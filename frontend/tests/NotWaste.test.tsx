import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { ServiceContainer } from '../src/app/ServiceContainer';
import { QueuedReport } from '../src/domain/QueuedReport';
import { ReportRejection } from '../src/domain/ReportRejection';
import type { ReportStatusView } from '../src/domain/ReportStatus';
import { RejectionToast } from '../src/features/snap/components/RejectionToast';
import { RejectionWatcher } from '../src/features/snap/RejectionWatcher';
import { ReportProgress } from '../src/features/snap/ReportProgress';
import { FakeReportApi } from './FakeReportApi';
import { MemoryStore, renderApp, testServices } from './helpers';
import { sampleDraft } from './snapFakes';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

const PHOTO = new TextEncoder().encode('jpeg').buffer;
const NOT_WASTE = { decision: 'rejected', judge: { report_type: 'not_waste' } } as const;
const UNCONFIRMED = { decision: 'rejected', judge: { report_type: 'waste_dump' } } as const;
const MESSAGE = "This doesn't look like a waste site. Please only report real dumps — false reports hide real problems.";

function view(status: ReportStatusView['status'], extra: Partial<ReportStatusView> = {}): ReportStatusView {
  return { report_id: 'rpt_test_1', status, site_id: null, blurred_url: null, updated_at: '2026-10-10T04:01:00Z', ...extra };
}

function sent(status: ReportStatusView | null): QueuedReport {
  const report = QueuedReport.capture(sampleDraft(), PHOTO, new Date('2026-10-10T04:00:00Z')).sent('rpt_test_1');
  return status === null ? report : report.withStatus(status);
}

describe('ReportRejection', () => {
  it('names not_waste only when the judge said not_waste, else unconfirmed', () => {
    expect(ReportRejection.reasonOf(view('rejected', { verification: NOT_WASTE }))).toBe('not_waste');
    expect(ReportRejection.reasonOf(view('rejected', { verification: UNCONFIRMED }))).toBe('unconfirmed');
    const noJudge = view('rejected', { verification: { decision: 'rejected', judge: null } });
    expect(ReportRejection.reasonOf(noJudge)).toBe('unconfirmed');
    const unsafe = view('rejected', { moderation: { outcome: 'rejected' }, verification: null });
    expect(ReportRejection.reasonOf(unsafe)).toBeNull();
    const neighbours = view('rejected', { verification: { decision: 'community_check', judge: null } });
    expect(ReportRejection.reasonOf(neighbours)).toBeNull();
    expect(ReportRejection.reasonOf(view('unverified', { verification: NOT_WASTE }))).toBeNull();
  });

  it('shows a firm alert badge and no celebration', () => {
    const report = sent(view('rejected', { verification: NOT_WASTE }));
    expect(ReportProgress.of(report)).toEqual({ key: 'not_waste', tone: 'alert' });
    expect(ReportProgress.celebrates(report)).toBe(false);
    expect(ReportProgress.celebrates(sent(view('unverified')))).toBe(true);
  });
});

describe('RejectionWatcher', () => {
  it('fires for a report seen open that comes back not waste, never for one already rejected', () => {
    const watcher = new RejectionWatcher();
    expect(watcher.turned([sent(view('rejected', { verification: NOT_WASTE }))])).toBeNull();
    const fresh = new RejectionWatcher();
    expect(fresh.turned([sent(null)])).toBeNull();
    expect(fresh.turned([sent(view('rejected', { verification: NOT_WASTE }))])).toBe('not_waste');
    expect(fresh.turned([sent(view('rejected', { verification: NOT_WASTE }))])).toBeNull();
  });
});

async function signedIn(api: FakeReportApi): Promise<ServiceContainer> {
  const services = testServices(new MemoryStore(), { api });
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  return services;
}

async function snapAndSend(user: UserEvent, api: FakeReportApi, language: 'en' | 'hi' = 'en') {
  const app = (
    <>
      <AppRoutes />
      <RejectionToast />
    </>
  );
  await renderApp(app, { route: '/snap', services: await signedIn(api), language });
  const shutter = await screen.findByRole('button', { name: language === 'hi' ? 'फ़ोटो लें' : 'Take photo' });
  await waitFor(() => expect(shutter).toBeEnabled());
  await user.click(shutter);
}

describe('A report turned down as not waste', () => {
  it('says so after upload, as a toast and in Activity', async () => {
    const user = userEvent.setup();
    const api = new FakeReportApi();
    api.status_ = 'rejected';
    api.verification_ = NOT_WASTE;
    await snapAndSend(user, api);
    await user.click(await screen.findByRole('radio', { name: 'Vacant plot' }));
    await user.click(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText('Not a waste site')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText(MESSAGE)).toHaveLength(2));
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.getAllByText(MESSAGE)).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'See all in Activity' }));
    const list = await screen.findByRole('list');
    expect(within(list).getByText('Not a waste site')).toBeInTheDocument();
    expect(within(list).getByText(MESSAGE)).toBeInTheDocument();
  });
});

describe('A report turned down as not waste, in Hindi', () => {
  it('says so in Hindi too', async () => {
    const user = userEvent.setup();
    const api = new FakeReportApi();
    api.status_ = 'rejected';
    api.verification_ = NOT_WASTE;
    await snapAndSend(user, api, 'hi');
    await user.click(await screen.findByRole('radio', { name: 'खाली प्लॉट' }));
    await user.click(screen.getByRole('button', { name: 'रिपोर्ट भेजें' }));
    expect(await screen.findByText('यह कचरे की जगह नहीं है')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText(/यह कचरे की जगह नहीं लगती।/)).toHaveLength(2));
  });
});

describe('A report the models rejected without a not_waste answer', () => {
  it('gets the generic message, never the not-waste one', async () => {
    const user = userEvent.setup();
    const api = new FakeReportApi();
    api.status_ = 'rejected';
    api.verification_ = UNCONFIRMED;
    await snapAndSend(user, api);
    await user.click(await screen.findByRole('radio', { name: 'Vacant plot' }));
    await user.click(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText('Waste not confirmed')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("Our checks couldn't confirm waste in this photo.")).toHaveLength(2));
    expect(screen.queryByText(MESSAGE)).toBeNull();
  });
});
