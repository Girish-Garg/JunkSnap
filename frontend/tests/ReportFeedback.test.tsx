import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import verificationJdh from '../../contracts/fixtures/verification_result.jdh-1.json';
import { AppRoutes } from '../src/app/AppRoutes';
import type { ServiceContainer } from '../src/app/ServiceContainer';
import type { Language } from '../src/i18n/LanguagePreference';
import { QueuedReport } from '../src/domain/QueuedReport';
import type { ReportStatusView } from '../src/domain/ReportStatus';
import { reportEvidenceLoaders } from '../src/services/reportFixtures';
import { FakeReportApi } from './FakeReportApi';
import { MemoryStore, renderApp, testServices } from './helpers';
import { MemoryReportStore, sampleDraft } from './snapFakes';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

const NOW = new Date('2026-10-10T04:00:00Z');

/** Answers GET /reports/{id} with the jdh-1 evidence, or 404 for anyone but the owner. */
class EvidenceApi extends FakeReportApi {
  rationale: string = verificationJdh.judge.rationale;
  owner = true;

  override async status(reportId: string): Promise<ReportStatusView> {
    if (!this.owner) {
      this.failNext('status', 404, 'not_found');
      return super.status(reportId);
    }
    const set = await reportEvidenceLoaders.snap();
    const verification = { ...set.verification, judge: set.verification.judge && { ...set.verification.judge, rationale: this.rationale } };
    return { report_id: reportId, status: 'verified', site_id: 'site_jdh_1', blurred_url: null, updated_at: '2026-10-10T04:01:00Z', ...set, verification };
  }
}

async function activityWith(api: EvidenceApi, language: Language = 'en', route = '/activity'): Promise<ServiceContainer> {
  const store = new MemoryReportStore();
  const view = { report_id: 'rpt_mine', status: 'verified', site_id: 'site_jdh_1', blurred_url: null, updated_at: '2026-10-10T04:01:00Z' } as const;
  await store.put(QueuedReport.capture(sampleDraft(), new ArrayBuffer(1), NOW).sent('rpt_mine').withStatus(view).data);
  const services = testServices(new MemoryStore(), { store, api });
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  await renderApp(<AppRoutes />, { route, services, language });
  return services;
}

describe('What we checked, from an Activity row', () => {
  it('shows the outcome, the AI check quote with its model, and a checklist without raw scores', async () => {
    const user = userEvent.setup();
    await activityWith(new EvidenceApi());
    const photos = await screen.findByRole('list', { name: 'Photos' });
    await user.click(within(photos).getByRole('button', { name: 'What we checked' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'What we checked' })).toBeInTheDocument();
    expect(await screen.findByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('AI check (Claude Sonnet on Amazon Bedrock)')).toBeInTheDocument();
    expect(screen.getByText(verificationJdh.judge.rationale)).toBeInTheDocument();
    expect(screen.getByText('Only you can see this.')).toBeInTheDocument();
    const checks = within(screen.getByRole('region', { name: 'Checks' }));
    expect(checks.getByText('Photo is real and from the in-app camera')).toBeInTheDocument();
    expect(checks.getByText('Faces and plates blurred')).toBeInTheDocument();
    expect(checks.getByText('Waste seen by the detector')).toBeInTheDocument();
    expect(checks.getByText('AI check agreed')).toBeInTheDocument();
    expect(checks.getByText('Location checked (GPS ±6 m)')).toBeInTheDocument();
    expect(checks.getAllByRole('img', { name: 'Passed' })).toHaveLength(5);
    expect(checks.getAllByText('strong')).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(/0\.9|95 ?%/);
  });
});

describe('What we checked, guarded', () => {
  it('shows a generic line instead of a reason that fails the guard', async () => {
    const api = new EvidenceApi();
    api.rationale = 'Waste outside the shop of Ramesh Kumar, call 98290 12345.';
    await activityWith(api, 'en', '/activity/reports/rpt_mine');
    expect(await screen.findByText('The AI check saw the reported problem in this photo.')).toBeInTheDocument();
    expect(screen.queryByText(/Ramesh|98290/)).not.toBeInTheDocument();
  });

  it('shows nothing of the report when the api does not answer this user (owner-only)', async () => {
    const api = new EvidenceApi();
    api.owner = false;
    await activityWith(api, 'en', '/activity/reports/rpt_mine');
    expect(await screen.findByText("Couldn't load the checks for this report. Try again in a moment.")).toBeInTheDocument();
    expect(screen.queryByText(/AI check/)).not.toBeInTheDocument();
  });

  it('speaks Hindi, while the AI reason stays in its own English', async () => {
    await activityWith(new EvidenceApi(), 'hi', '/activity/reports/rpt_mine');
    expect(await screen.findByRole('heading', { level: 2, name: 'हमने क्या जाँचा' })).toBeInTheDocument();
    expect(await screen.findByText('सत्यापित')).toBeInTheDocument();
    expect(screen.getByText('फ़ोटो असली है और ऐप के कैमरे से ली गई')).toBeInTheDocument();
    expect(screen.getByText(verificationJdh.judge.rationale)).toHaveAttribute('lang', 'en');
  });
});
