import { describe, expect, it } from 'vitest';
import { ReportOutcome, type OutcomeKind } from '../src/domain/ReportOutcome';
import type { ReportStatus, ReportStatusView } from '../src/domain/ReportStatus';

function view(status: ReportStatus, extra: Partial<ReportStatusView> = {}): ReportStatusView {
  return { report_id: 'rpt_test_1', status, site_id: null, blurred_url: null, updated_at: '2026-10-10T04:01:00Z', ...extra };
}

const PASSED = { outcome: 'passed' } as const;
const MODELS_NO = { decision: 'rejected', judge: { report_type: 'not_waste' } } as const;
const MODELS_UNSURE = { decision: 'rejected', judge: { report_type: 'waste_dump' } } as const;
const MODELS_UNCLEAR = { ...MODELS_NO, combiner: { version: 'fw-v0+judge_veto:unclear by bedrock/apac.amazon.nova-lite-v1:0@v1' } } as const;
const MODELS_YES ={ decision: 'community_check', judge: { report_type: 'waste_dump' } } as const;

describe('ReportOutcome for every report status', () => {
  it.each<[string, ReportStatusView, OutcomeKind]>([
    ['queued', view('queued'), 'checking'],
    ['processing', view('processing'), 'checking'],
    ['unverified', view('unverified', { site_id: 'site_jpr_1' }), 'waiting'],
    ['verified', view('verified', { site_id: 'site_jdh_1' }), 'verified'],
    ['withdrawn', view('withdrawn'), 'withdrawn'],
    ['needs_review', view('needs_review'), 'review'],
    ['rejected by moderation', view('rejected', { moderation: { outcome: 'rejected', reasons: ['duplicate'] } }), 'stopped'],
    ['rejected, judge could not see the photo', view('rejected', { moderation: PASSED, verification: MODELS_UNCLEAR }), 'unclear'],
    ['rejected, judge says not waste', view('rejected', { moderation: PASSED, verification: MODELS_NO }), 'not_waste'],
    ['rejected by the models otherwise', view('rejected', { moderation: PASSED, verification: MODELS_UNSURE }), 'unconfirmed'],
    ['rejected with no judge', view('rejected', { moderation: PASSED, verification: { decision: 'rejected', judge: null } }), 'unconfirmed'],
    ['rejected after the models passed it', view('rejected', { moderation: PASSED, verification: MODELS_YES }), 'removed'],
  ])('%s', (_case, status, kind) => {
    expect(ReportOutcome.of(status)).toBe(kind);
  });
});

describe('ReportOutcome display rules', () => {
  it('reads the pre-1530 community_check status as waiting', () => {
    const old = { ...view('unverified'), status: 'community_check' } as unknown as ReportStatusView;
    expect(ReportOutcome.of(old)).toBe('waiting');
  });

  it('gives each outcome a tone, and offers retake tips only when a new photo could help', () => {
    expect(ReportOutcome.tone('verified')).toBe('good');
    expect(ReportOutcome.tone('waiting')).toBe('plain');
    expect(ReportOutcome.tone('checking')).toBe('plain');
    expect((['unclear', 'not_waste', 'unconfirmed', 'stopped', 'removed'] as const).map((kind) => ReportOutcome.tone(kind))).toEqual(['alert', 'alert', 'alert', 'alert', 'alert']);
    const retake = (['checking', 'waiting', 'verified', 'unclear', 'not_waste', 'unconfirmed', 'withdrawn', 'removed', 'stopped', 'review'] as const).filter((kind) =>
      ReportOutcome.suggestsRetake(kind),
    );
    expect(retake).toEqual(['unclear', 'not_waste', 'unconfirmed', 'removed', 'stopped']);
  });

  it('re-reads only while checking', () => {
    expect(ReportOutcome.isSettling('checking')).toBe(true);
    expect(ReportOutcome.isSettling('waiting')).toBe(false);
  });
});
