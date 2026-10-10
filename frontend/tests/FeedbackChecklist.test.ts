import { describe, expect, it } from 'vitest';
import moderationJdh from '../../contracts/fixtures/moderation_result.jdh-1.json';
import moderationJpr from '../../contracts/fixtures/moderation_result.jpr-1.json';
import uploadJdh from '../../contracts/fixtures/report_upload.jdh-1.json';
import uploadJpr from '../../contracts/fixtures/report_upload.jpr-1.json';
import verificationJdh from '../../contracts/fixtures/verification_result.jdh-1.json';
import verificationJpr from '../../contracts/fixtures/verification_result.jpr-1.json';
import { FeedbackChecklist, type CheckItem } from '../src/domain/FeedbackChecklist';
import { JudgeQuote } from '../src/domain/JudgeQuote';
import { ModelLabel } from '../src/domain/ModelLabel';
import type { ModerationEvidence, UploadEvidence, VerificationEvidence } from '../src/domain/ReportEvidence';
import type { ReportStatus, ReportStatusView } from '../src/domain/ReportStatus';

const JDH = {
  report: uploadJdh as unknown as UploadEvidence,
  moderation: moderationJdh as unknown as ModerationEvidence,
  verification: verificationJdh as unknown as VerificationEvidence,
};
const JPR = {
  report: uploadJpr as unknown as UploadEvidence,
  moderation: moderationJpr as unknown as ModerationEvidence,
  verification: verificationJpr as unknown as VerificationEvidence,
};

function view(status: ReportStatus, extra: Partial<ReportStatusView>): ReportStatusView {
  return { report_id: 'rpt_test_1', status, site_id: null, blurred_url: null, updated_at: '2026-10-10T04:01:00Z', ...extra };
}

// name: mark/variant/band, so one string says the whole row.
const rows = (items: readonly CheckItem[]) => items.map((item) => `${item.name}:${item.mark}/${item.variant}/${item.band ?? '-'}`);

describe('FeedbackChecklist from the contract fixtures', () => {
  it('jdh-1 (auto-verified snap): every check passes, the model checks firmly', () => {
    const items = FeedbackChecklist.of(view('verified', JDH));
    expect(rows(items)).toEqual([
      'authentic:pass/pass/-',
      'blurred:pass/pass/-',
      'detector:pass/pass/strong',
      'judge:pass/pass/strong',
      'location:pass/pass/-',
    ]);
    expect(items[4]?.metres).toBe(6);
  });

  it('jpr-1 (scan frame sent to neighbours): the detector and the AI check agree weakly', () => {
    const items = FeedbackChecklist.of(view('unverified', JPR));
    expect(rows(items)).toEqual([
      'authentic:pass/pass/-',
      'blurred:pass/pass/-',
      'detector:pass/pass/weak',
      'judge:pass/pass/weak',
      'location:pass/pass/-',
    ]);
    expect(items[4]?.metres).toBe(14);
  });
});

describe('FeedbackChecklist before the checks', () => {
  it('a report still in the pipeline shows every check as not done yet', () => {
    expect(rows(FeedbackChecklist.of(view('queued', {})))).toEqual([
      'authentic:skip/pending/-',
      'blurred:skip/pending/-',
      'detector:skip/pending/-',
      'judge:skip/pending/-',
      'location:skip/pending/-',
    ]);
  });
});

describe('FeedbackChecklist for photos that did not pass', () => {
  it('a repeat view stopped by moderation was never blurred or judged', () => {
    const checks = { ...JPR.moderation.checks, duplicate: { result: 'fail' }, rate_limit: { result: 'skipped' }, device_token: { result: 'skipped' } } as const;
    const moderation: ModerationEvidence = { ...JPR.moderation, outcome: 'rejected', reasons: ['duplicate'], blur: null, checks };
    expect(rows(FeedbackChecklist.of(view('rejected', { report: JPR.report, moderation, verification: null })))).toEqual([
      'authentic:skip/not_reached/-',
      'blurred:skip/never_shown/-',
      'detector:skip/stopped/not_used',
      'judge:skip/stopped/not_used',
      'location:pass/pass/-',
    ]);
  });

  it('a stale photo fails the camera checks, and a point outside India fails the location', () => {
    const stale: ModerationEvidence = { ...JDH.moderation, outcome: 'rejected', reasons: ['stale_timestamp'], blur: null };
    expect(FeedbackChecklist.of(view('rejected', { moderation: stale }))[0]?.mark).toBe('fail');
    const outside: ModerationEvidence = { ...JDH.moderation, outcome: 'rejected', reasons: ['outside_india'], checks: { inside_india: { result: 'fail' } } };
    expect(FeedbackChecklist.of(view('rejected', { moderation: outside }))[4]).toMatchObject({ mark: 'fail', variant: 'fail' });
  });

  it('the AI check disagrees when it vetoes the photo as not waste', () => {
    const signals = JPR.verification.signals?.map((signal) => (signal.name === 'vision_judge' ? { ...signal, score: 0.08 } : signal));
    const verification: VerificationEvidence = { ...JPR.verification, decision: 'rejected', judge: { report_type: 'not_waste', rationale: '' }, signals };
    const items = FeedbackChecklist.of(view('rejected', { ...JPR, verification }));
    expect(rows(items)[3]).toBe('judge:fail/fail/strong');
  });
});

describe('FeedbackChecklist edge cases', () => {
  it('says the detector is not trained for contaminated water', () => {
    const report = { ...JPR.report, report_type: 'contaminated_water' };
    expect(rows(FeedbackChecklist.of(view('unverified', { ...JPR, report })))[2]).toBe('detector:skip/untrained/not_used');
  });

  it('says the AI check was not needed when the judge did not run', () => {
    const verification = { ...JDH.verification, judge: null, signals: JDH.verification.signals?.filter((s) => s.name !== 'vision_judge') };
    expect(rows(FeedbackChecklist.of(view('verified', { ...JDH, verification })))[3]).toBe('judge:skip/not_needed/not_used');
  });

  it('never carries a raw score, only bands', () => {
    const items = FeedbackChecklist.of(view('verified', JDH));
    expect(JSON.stringify(items)).not.toMatch(/0\.\d/);
  });
});

describe('JudgeQuote and ModelLabel', () => {
  it('quotes the fixture reason with the judge named from its evidence', () => {
    const quote = JudgeQuote.of(view('verified', JDH));
    expect(quote?.text).toBe(verificationJdh.judge.rationale);
    expect(quote?.agreed).toBe(true);
    expect(quote?.label).toMatchObject({ model: 'Claude Sonnet', provider: 'Amazon Bedrock', exact: 'global.anthropic.claude-sonnet-4-6 · 4.6' });
  });

  it('names Nova Lite on Amazon Bedrock from its model id', () => {
    expect(new ModelLabel({ provider: 'bedrock', model: 'apac.amazon.nova-lite-v1:0', version: 'v1:0' })).toMatchObject({
      model: 'Nova Lite',
      provider: 'Amazon Bedrock',
    });
    expect(new ModelLabel({ provider: 'openai', model: 'gpt-4.1-mini', version: '2025-04-14' })).toMatchObject({ model: 'gpt-4.1-mini', provider: 'OpenAI' });
  });

  it('has nothing to quote when the judge did not run', () => {
    expect(JudgeQuote.of(view('verified', { ...JDH, verification: { ...JDH.verification, judge: null } }))).toBeNull();
  });
});
