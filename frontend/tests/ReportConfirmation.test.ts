import { describe, expect, it } from 'vitest';
import confirmFixture from '../../contracts/fixtures/verification_result.jdh-confirm.json';
import en from '../src/i18n/en.json';
import hi from '../src/i18n/hi.json';
import { QueuedReport } from '../src/domain/QueuedReport';
import { ConfirmationAsk, type ReportConfirmation } from '../src/domain/ReportConfirmation';
import { ReportStatuses, type ReportStatus, type ReportStatusView } from '../src/domain/ReportStatus';
import { ConfirmWatcher } from '../src/features/snap/ConfirmWatcher';
import { ReportProgress } from '../src/features/snap/ReportProgress';
import { ReportTracker } from '../src/services/ReportTracker';
import { sampleDraft } from './snapFakes';

const NOW = new Date('2026-10-11T09:40:00Z');

const ASKED: ReportConfirmation = {
  question: "Our check wasn't sure this shows a waste dump. Only report it if you're 100% sure.",
  reasoning: confirmFixture.judge.rationale,
  report_type: 'waste_dump',
  asked_at: '2026-10-11T09:40:14Z',
  expires_at: '2026-10-12T09:40:14Z',
  answer: null,
  answered_at: null,
};

function view(status: ReportStatus, confirmation: ReportConfirmation | null = null): ReportStatusView {
  return { report_id: 'rpt_ask', status, site_id: null, blurred_url: null, updated_at: '2026-10-11T09:40:14Z', confirmation };
}

function sent(status: ReportStatusView | null, sha = 'a'.repeat(64)): QueuedReport {
  const report = QueuedReport.capture(sampleDraft(sha), new ArrayBuffer(1), NOW).sent('rpt_ask');
  return status ? report.withStatus(status) : report;
}

describe('ConfirmationAsk', () => {
  it('asks only for a needs_confirmation report, naming its type and the cleaned reason', () => {
    expect(ConfirmationAsk.of(view('needs_confirmation', ASKED))).toEqual({ reportId: 'rpt_ask', reportType: 'waste_dump', reasoning: confirmFixture.judge.rationale });
    expect(ConfirmationAsk.of(view('processing', { ...ASKED, answer: 'sure', answered_at: '2026-10-11T10:00:00Z' }))).toBeNull();
    expect(ConfirmationAsk.of(view('not_confirmed', { ...ASKED, answer: 'expired' }))).toBeNull();
    expect(ConfirmationAsk.of(null)).toBeNull();
  });

  it('drops a reason that could name someone, and an unknown type', () => {
    const risky = { ...ASKED, reasoning: 'Waste near the shop of Mr Sharma, call 98290 12345.', report_type: 'not_waste' };
    expect(ConfirmationAsk.of(view('needs_confirmation', risky))).toEqual({ reportId: 'rpt_ask', reportType: null, reasoning: null });
  });

  it('falls back to the type that was sent when the confirmation is missing', () => {
    const bare = { ...view('needs_confirmation'), report: { report_type: 'overflowing_bin' } };
    expect(ConfirmationAsk.of(bare)?.reportType).toBe('overflowing_bin');
  });
});

describe('Report statuses of contracts v1.16', () => {
  it('keeps a needs_confirmation report open and ends a not_confirmed one', () => {
    expect(ReportStatuses.isFinal('needs_confirmation')).toBe(false);
    expect(ReportStatuses.inPipeline('needs_confirmation')).toBe(false);
    expect(ReportStatuses.isFinal('not_confirmed')).toBe(true);
    expect(ReportTracker.isOpen(sent(view('needs_confirmation', ASKED)))).toBe(true);
    expect(ReportTracker.isOpen(sent(view('not_confirmed')))).toBe(false);
  });

  it('stops polling and celebrating while the reporter is asked, and polls again once they are sure', () => {
    const asked = sent(view('needs_confirmation', ASKED));
    expect(ReportProgress.isChecking(asked)).toBe(false);
    expect(ReportProgress.celebrates(asked)).toBe(false);
    expect(ReportProgress.of(asked)).toEqual({ key: 'needs_confirmation', tone: 'plain' });
    expect(ReportProgress.of(sent(view('not_confirmed')))).toEqual({ key: 'not_confirmed', tone: 'alert' });
    expect(ReportProgress.isChecking(asked.withStatus(view('processing')))).toBe(true);
  });
});

describe('ConfirmWatcher', () => {
  it('raises the question once, only for a report seen open before it was asked', () => {
    const watcher = new ConfirmWatcher();
    const already = sent(view('needs_confirmation', ASKED), 'b'.repeat(64));
    expect(watcher.asked([sent(view('processing')), already])).toBeNull();
    expect(watcher.asked([sent(view('needs_confirmation', ASKED)), already])?.reportType).toBe('waste_dump');
    expect(watcher.asked([sent(view('needs_confirmation', ASKED)), already])).toBeNull();
  });
});

describe('Confirmation wording', () => {
  it('has every new string in Hindi, in Devanagari', () => {
    const pairs: [Record<string, unknown>, Record<string, unknown>][] = [
      [en.confirm, hi.confirm],
      [en.confirm.errors, hi.confirm.errors],
    ];
    for (const [english, hindi] of pairs) {
      for (const [key, text] of Object.entries(english)) {
        if (typeof text !== 'string') continue;
        expect(hindi[key], key).toMatch(/\p{Script=Devanagari}/u);
      }
    }
    const singles = [
      hi.progress.needs_confirmation,
      hi.progress.not_confirmed,
      hi.feedback.outcome.asking,
      hi.feedback.outcome.not_confirmed,
      hi.feedback.explain.asking,
      hi.feedback.explain.not_confirmed,
    ];
    singles.forEach((text) => expect(text).toMatch(/\p{Script=Devanagari}/u));
    expect(hi.confirm.question).toContain('{{type}}');
    expect(en.confirm.question).toContain('{{type}}');
  });

  it('addresses the reporter as you and names nobody', () => {
    expect(en.confirm.question).toMatch(/you're 100% sure/);
    expect(en.confirm.notConfirmed).toBe('No answer within 24 hours, so this report was not added to the map.');
  });
});
