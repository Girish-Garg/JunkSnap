import { describe, expect, it } from 'vitest';
import confirmFixture from '../../contracts/fixtures/verification_result.jdh-confirm.json';
import type { ReportStatusView } from '../src/domain/ReportStatus';
import { MockConfirmations } from '../src/services/MockConfirmations';
import { MockReportApi } from '../src/services/MockReportApi';
import { reportEvidenceLoaders } from '../src/services/reportFixtures';
import { sampleSiteLoader } from '../src/services/siteFixtures';
import { DEVICE_TOKEN, sampleDraft } from './snapFakes';

function mockApi(): MockReportApi {
  return new MockReportApi(sampleSiteLoader, 0, null, new MockConfirmations(reportEvidenceLoaders.confirm));
}

async function send(api: MockReportApi, uploadId: string): Promise<string> {
  const upload = { ...sampleDraft(), report_type: 'overflowing_bin', upload_id: uploadId, capture_mode: 'snap', device_token: DEVICE_TOKEN } as const;
  return (await api.submit(upload)).report_id;
}

async function settle(api: MockReportApi, reportId: string): Promise<ReportStatusView> {
  await api.status(reportId);
  await api.status(reportId);
  return api.status(reportId);
}

describe('Mock mode reporter confirmation', () => {
  it('asks about every second report, with the jdh-confirm reason and a 24 hour window', async () => {
    const api = mockApi();
    const first = await send(api, 'upl_mock_1');
    const second = await send(api, 'upl_mock_2');
    expect((await settle(api, first)).status).toBe('verified');
    const asked = await settle(api, second);
    expect(asked.status).toBe('needs_confirmation');
    expect(asked.verification?.decision).toBe('needs_confirmation');
    expect(asked.confirmation).toMatchObject({ reasoning: confirmFixture.judge.rationale, report_type: 'overflowing_bin', answer: null, answered_at: null });
    const window = Date.parse(asked.confirmation?.expires_at ?? '') - Date.parse(asked.confirmation?.asked_at ?? '');
    expect(window).toBe(24 * 60 * 60 * 1000);
  });

  it('sends a sure report back to the checks, then on to the map; the same answer again is fine', async () => {
    const api = mockApi();
    await send(api, 'upl_mock_1');
    const reportId = await send(api, 'upl_mock_2');
    await settle(api, reportId);
    const answered = await api.confirm(reportId, { sure: true });
    expect(answered.status).toBe('processing');
    expect(answered.confirmation).toMatchObject({ answer: 'sure', answered_at: expect.any(String) });
    expect((await api.confirm(reportId, { sure: true })).status).toBe('processing');
    expect((await api.status(reportId)).status).toBe('verified');
  });
});

describe('Mock mode answers', () => {
  it('withdraws a report the reporter is not sure about, and closes the question to any other answer', async () => {
    const api = mockApi();
    await send(api, 'upl_mock_1');
    const reportId = await send(api, 'upl_mock_2');
    await settle(api, reportId);
    expect((await api.confirm(reportId, { sure: false })).status).toBe('withdrawn');
    expect((await api.status(reportId)).status).toBe('withdrawn');
    await expect(api.confirm(reportId, { sure: true })).rejects.toMatchObject({ status: 409, code: 'confirmation_closed' });
  });

  it('refuses an answer for a report nobody asked about', async () => {
    const api = mockApi();
    const reportId = await send(api, 'upl_mock_1');
    await settle(api, reportId);
    await expect(api.confirm(reportId, { sure: true })).rejects.toMatchObject({ status: 409, code: 'confirmation_closed' });
    await expect(new MockReportApi(sampleSiteLoader, 0).confirm(reportId, { sure: true })).rejects.toMatchObject({ code: 'confirmation_closed' });
  });
});
