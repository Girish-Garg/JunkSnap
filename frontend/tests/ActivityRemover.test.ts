import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/domain/ApiError';
import { QueuedReport } from '../src/domain/QueuedReport';
import { QueuedScan } from '../src/domain/QueuedScan';
import type { ReportStatus, ReportStatusView } from '../src/domain/ReportStatus';
import type { WithdrawalResult } from '../src/domain/SiteActions';
import { ActivityDeleteMessage } from '../src/features/activity/ActivityDeleteMessage';
import { ActivityRemover } from '../src/services/ActivityRemover';
import { sampleDraft } from './snapFakes';

const NOW = new Date('2026-10-10T04:00:00Z');
const view = (id: string, status: ReportStatus, site: string | null): ReportStatusView => ({
  report_id: id, status, site_id: site, blurred_url: null, updated_at: '2026-10-10T04:01:00Z',
});

function photo(status: ReportStatus | null, site: string | null = 'site_a'): QueuedReport {
  const saved = QueuedReport.capture(sampleDraft(), new ArrayBuffer(1), NOW);
  return status === null ? saved : saved.sent('rpt_1').withStatus(view('rpt_1', status, site));
}

function scan(reportIds: readonly string[]): QueuedScan {
  const draft = {
    report_type: 'waste_dump', context: 'roadside', started_at: '2026-10-10T04:00:00Z', ended_at: '2026-10-10T04:00:06Z',
    duration_ms: 6000, content_type: 'video/webm', video_sha256: 'c'.repeat(64), size_bytes: 5, gps_track: [],
  } as const;
  const status = { scan_id: 'scn_1', status: 'done', reason: null, frames: null, report_ids: reportIds, updated_at: '2026-10-10T04:02:00Z' } as const;
  return QueuedScan.record(draft, new ArrayBuffer(1), NOW).withStatus(status);
}

// In-memory ports: removed row ids, withdrawn site ids, frame statuses and scripted withdrawal answers.
function rig(frames: Record<string, ReportStatusView | null> = {}, answers: Record<string, WithdrawalResult | ApiError> = {}) {
  const removed: string[] = [];
  const withdrawn: string[] = [];
  const dismissed: string[] = [];
  const marked: string[] = [];
  const remover = new ActivityRemover({
    dismissed: { add: async (id) => void dismissed.push(id) },
    marks: { markWithdrawn: async (ids) => void marked.push(...ids) },
    reports: { remove: async (id) => void removed.push(id) },
    scans: { remove: async (id) => void removed.push(id) },
    statuses: {
      status: async (id) => {
        const found = frames[id];
        if (found === undefined || found === null) throw new ApiError(404, 'not_found', 'gone');
        return found;
      },
    },
    sites: {
      withdraw: async (siteId) => {
        withdrawn.push(siteId);
        const answer = answers[siteId];
        if (answer instanceof ApiError) throw answer;
        return answer ?? { site_id: siteId, withdrawn_report_ids: [], site_removed: true, status: 'removed', verification: 'unverified', backers: { count: 1, needed: 10, photo_people: 1, vote_people: 0 } };
      },
    },
  });
  return { remover, removed, withdrawn, dismissed, marked };
}

describe('ActivityRemover for a photo row', () => {
  it('withdraws a report on an unverified site, then removes the row', async () => {
    const { remover, removed, withdrawn } = rig();
    const report = photo('unverified');
    expect(remover.planReport(report)).toBe('withdraw');
    expect(await remover.removeReport(report)).toEqual({ kind: 'withdraw', sitesRemoved: 1, verifiedKept: false });
    expect(withdrawn).toEqual(['site_a']);
    expect(removed).toEqual([report.id]);
  });

  it("shows this user's other reports the api withdrew from that site as withdrawn", async () => {
    const answer = { site_id: 'site_a', withdrawn_report_ids: ['rpt_1', 'rpt_2'], site_removed: false, status: 'open', verification: 'unverified', backers: { count: 2, needed: 10, photo_people: 2, vote_people: 0 } } as const;
    const { remover, marked } = rig({}, { site_a: answer });
    await remover.removeReport(photo('unverified'));
    expect(marked).toEqual(['rpt_1', 'rpt_2']);
  });

  it('only hides a report on a verified site, which stays on the map', async () => {
    const { remover, removed, withdrawn } = rig();
    const report = photo('verified');
    expect(remover.planReport(report)).toBe('verified');
    const outcome = await remover.removeReport(report);
    expect(outcome).toEqual({ kind: 'verified', sitesRemoved: 0, verifiedKept: true });
    expect(ActivityDeleteMessage.of(outcome)).toBe('activityDelete.verifiedKept');
    expect(withdrawn).toEqual([]);
    expect(removed).toEqual([report.id]);
  });

});

describe('ActivityRemover for a row with no site to change', () => {
  it.each([
    ['rejected', photo('rejected', null)],
    ['withdrawn', photo('withdrawn')],
    ['never sent', photo(null)],
    ['refused', photo(null).failed('refused', null)],
  ])('just removes a %s row from this phone', async (_name, report) => {
    const { remover, removed, withdrawn } = rig();
    expect(remover.planReport(report)).toBe('local');
    expect(await remover.removeReport(report)).toEqual({ kind: 'local', sitesRemoved: 0, verifiedKept: false });
    expect(withdrawn).toEqual([]);
    expect(removed).toEqual([report.id]);
  });

  it('still removes the row when the site was verified in the meantime, and says the site stays', async () => {
    const { remover, removed } = rig({}, { site_a: new ApiError(409, 'site_verified', 'verified') });
    expect(await remover.removeReport(photo('unverified'))).toMatchObject({ verifiedKept: true });
    expect(removed).toHaveLength(1);
  });

  it('keeps the row when the withdrawal fails for another reason', async () => {
    const { remover, removed } = rig({}, { site_a: new ApiError(500, 'server_error', 'down') });
    await expect(remover.removeReport(photo('unverified'))).rejects.toThrow(ApiError);
    expect(removed).toEqual([]);
  });
});

describe('ActivityRemover for a scan row', () => {
  it('withdraws its frames from each unverified site once and says a verified site stays', async () => {
    const frames = {
      rpt_f1: view('rpt_f1', 'unverified', 'site_a'),
      rpt_f2: view('rpt_f2', 'unverified', 'site_a'),
      rpt_f3: view('rpt_f3', 'verified', 'site_b'),
      rpt_f4: view('rpt_f4', 'rejected', null),
      rpt_f5: null,
    };
    const { remover, removed, withdrawn } = rig(frames);
    const recording = scan(Object.keys(frames));
    expect(await remover.planScan(recording)).toBe('withdraw');
    expect(await remover.removeScan(recording)).toEqual({ kind: 'withdraw', sitesRemoved: 1, verifiedKept: true });
    expect(withdrawn).toEqual(['site_a']);
    expect(removed).toEqual([recording.id]);
  });

  it('just removes a scan that made no frame reports', async () => {
    const { remover, removed, withdrawn } = rig();
    expect(await remover.planScan(scan([]))).toBe('local');
    await remover.removeScan(scan([]));
    expect(withdrawn).toEqual([]);
    expect(removed).toHaveLength(1);
  });
});
