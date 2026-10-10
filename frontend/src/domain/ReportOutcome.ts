import { ReportRejection } from './ReportRejection';
import type { ReportStatus, ReportStatusView } from './ReportStatus';

/**
 * What became of one report, in the reporter's words. stopped: the photo checks (moderation)
 * turned it away; review: the pipeline gave up on it (needs_review); removed: neighbours hid its site.
 */
export type OutcomeKind =
  | 'checking'
  | 'waiting'
  | 'verified'
  | 'not_waste'
  | 'unconfirmed'
  | 'withdrawn'
  | 'removed'
  | 'stopped'
  | 'review';

export type OutcomeTone = 'plain' | 'good' | 'alert';

const BY_STATUS: Readonly<Record<Exclude<ReportStatus, 'rejected'>, OutcomeKind>> = {
  queued: 'checking',
  processing: 'checking',
  unverified: 'waiting',
  verified: 'verified',
  needs_review: 'review',
  withdrawn: 'withdrawn',
};

const TONES: Readonly<Partial<Record<OutcomeKind, OutcomeTone>>> = {
  verified: 'good',
  not_waste: 'alert',
  unconfirmed: 'alert',
  removed: 'alert',
  stopped: 'alert',
};

// Outcomes where the reporter can do better with a new photo, so the view offers retake tips.
const RETAKE: ReadonlySet<OutcomeKind> = new Set(['not_waste', 'unconfirmed', 'stopped', 'removed']);

/** Maps GET /reports/{id} to one plain outcome; rows from before decision 20261010-1530 say community_check. */
export class ReportOutcome {
  static of(view: ReportStatusView): OutcomeKind {
    const status: string = view.status;
    if (status === 'community_check') return 'waiting';
    if (view.status !== 'rejected') return BY_STATUS[view.status];
    if (view.moderation?.outcome === 'rejected') return 'stopped';
    return ReportRejection.reasonOf(view) ?? 'removed';
  }

  static tone(kind: OutcomeKind): OutcomeTone {
    return TONES[kind] ?? 'plain';
  }

  static suggestsRetake(kind: OutcomeKind): boolean {
    return RETAKE.has(kind);
  }

  /** Still moving through the pipeline, so the view reads it again shortly. */
  static isSettling(kind: OutcomeKind): boolean {
    return kind === 'checking';
  }
}
