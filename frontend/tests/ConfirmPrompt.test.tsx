import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import confirmFixture from '../../contracts/fixtures/verification_result.jdh-confirm.json';
import { AppRoutes } from '../src/app/AppRoutes';
import type { ServiceContainer } from '../src/app/ServiceContainer';
import type { ConfirmRequest, ReportConfirmation } from '../src/domain/ReportConfirmation';
import { QueuedReport } from '../src/domain/QueuedReport';
import type { ReportStatusView } from '../src/domain/ReportStatus';
import { ConfirmToast } from '../src/features/snap/components/ConfirmToast';
import type { Language } from '../src/i18n/LanguagePreference';
import { FakeReportApi } from './FakeReportApi';
import { MemoryStore, renderApp, testServices } from './helpers';
import { MemoryReportStore, sampleDraft } from './snapFakes';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

const NOW = new Date('2026-10-11T09:40:00Z');
const QUESTION = "Our check wasn't sure this shows “Waste dump”. Only report it if you're 100% sure.";
const ASKED: ReportConfirmation = {
  question: "Our check wasn't sure this shows a waste dump. Only report it if you're 100% sure.",
  reasoning: confirmFixture.judge.rationale,
  report_type: 'waste_dump',
  asked_at: '2026-10-11T09:40:14Z',
  expires_at: '2026-10-12T09:40:14Z',
  answer: null,
  answered_at: null,
};

function asking(reportId: string): ReportStatusView {
  return { report_id: reportId, status: 'needs_confirmation', site_id: null, blurred_url: null, updated_at: '2026-10-11T09:40:14Z', confirmation: ASKED };
}

/** Answers GET /reports/{id} with needs_confirmation until the reporter answers; hold keeps the answer in flight. */
class AskingApi extends FakeReportApi {
  answered = false;
  hold = false;
  release: () => void = () => undefined;

  override async status(reportId: string): Promise<ReportStatusView> {
    return this.answered ? super.status(reportId) : asking(reportId);
  }

  override async confirm(reportId: string, request: ConfirmRequest): Promise<ReportStatusView> {
    if (this.hold) await new Promise<void>((resolve) => (this.release = resolve));
    const view = await super.confirm(reportId, request);
    this.answered = true;
    return view;
  }
}

interface Setup {
  readonly route?: string;
  readonly language?: Language;
  readonly status?: ReportStatusView;
  readonly toast?: boolean;
}

async function render(api: AskingApi, setup: Setup = {}): Promise<ServiceContainer> {
  const store = new MemoryReportStore();
  const report = QueuedReport.capture(sampleDraft(), new ArrayBuffer(1), NOW).sent('rpt_mine');
  await store.put(report.withStatus(setup.status ?? asking('rpt_mine')).data);
  const services = testServices(new MemoryStore(), { store, api });
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  const ui = setup.toast ? <><AppRoutes /><ConfirmToast /></> : <AppRoutes />;
  await renderApp(ui, { route: setup.route ?? '/activity', services, language: setup.language ?? 'en' });
  return services;
}

describe('Reporter confirmation in Activity', () => {
  it('asks with the report type and the AI check reason, and sends sure: true for "Yes, I\'m sure"', async () => {
    const user = userEvent.setup();
    const api = new AskingApi();
    await render(api);
    expect(await screen.findByText(QUESTION)).toBeInTheDocument();
    expect(screen.getByText(confirmFixture.judge.rationale)).toHaveAttribute('lang', 'en');
    expect(screen.getByText('Your answer needed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "Yes, I'm sure" }));
    await waitFor(() => expect(api.bodies('confirm')).toEqual([{ reportId: 'rpt_mine', sure: true }]));
    expect(await screen.findByText('Checking the photo')).toBeInTheDocument();
    expect(screen.queryByText(QUESTION)).not.toBeInTheDocument();
  });

  it('sends sure: false for "Withdraw" and then shows the report as withdrawn', async () => {
    const user = userEvent.setup();
    const api = new AskingApi();
    await render(api);
    await user.click(await screen.findByRole('button', { name: 'Withdraw' }));
    await waitFor(() => expect(api.bodies('confirm')).toEqual([{ reportId: 'rpt_mine', sure: false }]));
    expect(await screen.findByText('Withdrawn')).toBeInTheDocument();
  });
});

describe('Reporter confirmation in Activity, while sending', () => {
  it('disables both answers while one is in flight', async () => {
    const user = userEvent.setup();
    const api = new AskingApi();
    api.hold = true;
    await render(api);
    await user.click(await screen.findByRole('button', { name: "Yes, I'm sure" }));
    expect(await screen.findByText('Sending your answer…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Yes, I'm sure" })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Withdraw' })).toBeDisabled();
    await act(async () => api.release());
    expect(await screen.findByText('Checking the photo')).toBeInTheDocument();
  });

  it('explains a closed question (409) and keeps the answers on screen', async () => {
    const user = userEvent.setup();
    const api = new AskingApi();
    api.failNext('confirm', 409, 'confirmation_closed');
    await render(api);
    await user.click(await screen.findByRole('button', { name: "Yes, I'm sure" }));
    expect(await screen.findByText('This report is no longer waiting for your answer.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Yes, I'm sure" })).toBeEnabled();
  });
});

describe('Reporter confirmation in Activity, after a closed question', () => {
  it('reads the report again after a closed question, so the answers stop being live', async () => {
    const user = userEvent.setup();
    const api = new AskingApi();
    api.failNext('confirm', 409, 'confirmation_closed');
    const services = await render(api);
    const read = vi.spyOn(services.snap.tracker, 'read');
    const sure = await screen.findByRole('button', { name: "Yes, I'm sure" });
    api.answered = true;
    api.status_ = 'not_confirmed';
    await user.click(sure);
    await waitFor(() => expect(read).toHaveBeenCalledWith('rpt_mine'));
    await waitFor(() => expect(screen.queryByRole('button', { name: "Yes, I'm sure" })).not.toBeInTheDocument());
  });
});

describe('Reporter confirmation in Activity, closed or in Hindi', () => {
  it('says why a report with no answer never reached the map', async () => {
    const api = new AskingApi();
    api.answered = true;
    api.status_ = 'not_confirmed';
    const closed = { ...asking('rpt_mine'), status: 'not_confirmed', confirmation: { ...ASKED, answer: 'expired' } } as const;
    await render(api, { status: closed });
    expect(await screen.findByText('No answer within 24 hours, so this report was not added to the map.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Yes, I'm sure" })).not.toBeInTheDocument();
  });

  it('asks in Hindi with the Hindi type label', async () => {
    await render(new AskingApi(), { language: 'hi' });
    expect(await screen.findByText('हमारी जाँच पक्का नहीं कर पाई कि इसमें “कचरे का ढेर” दिख रहा है। तभी रिपोर्ट करें जब आप 100% पक्के हों।')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'हाँ, मुझे पक्का है' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'वापस लें' })).toBeInTheDocument();
  });
});

describe('Reporter confirmation in "What we checked" and the toast', () => {
  it('shows the question in the report view, and checks again after "Yes, I\'m sure"', async () => {
    const user = userEvent.setup();
    const api = new AskingApi();
    await render(api, { route: '/activity/reports/rpt_mine' });
    expect(await screen.findByText(QUESTION)).toBeInTheDocument();
    expect(screen.getByText('Answer within 24 hours. Until then, this report is not on the map.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "Yes, I'm sure" }));
    expect(await screen.findByText('Checking…')).toBeInTheDocument();
    expect(screen.queryByText(QUESTION)).not.toBeInTheDocument();
  });

  it('raises a toast when a report is just asked, which opens the question', async () => {
    const user = userEvent.setup();
    const api = new AskingApi();
    const processing = { ...asking('rpt_mine'), status: 'processing', confirmation: null } as const;
    const services = await render(api, { route: '/', status: processing, toast: true });
    await act(async () => services.snap.tracker.refresh('a'.repeat(64)));
    const toast = await screen.findByRole('alert');
    expect(toast).toHaveTextContent(QUESTION);
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'What we checked' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Withdraw' })).toBeInTheDocument();
  });
});
