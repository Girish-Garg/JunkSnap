import type { ModerationEvidence, VerificationEvidence } from '../domain/ReportEvidence';
import type { ReportStatusView } from '../domain/ReportStatus';
import type { FrameFinding } from '../domain/ScanUpload';
import type { ReportEvidenceLoaders, ReportEvidenceSet } from './reportFixtures';

type FrameView = (set: ReportEvidenceSet, frame: FrameFinding) => Pick<ReportStatusView, 'status' | 'moderation' | 'verification'>;

// A repeat view: moderation stops it at the duplicate check, so later checks are skipped and nothing is blurred.
function repeatView(moderation: ModerationEvidence): ModerationEvidence {
  const checks = { ...moderation.checks, duplicate: { result: 'fail' }, rate_limit: { result: 'skipped' }, device_token: { result: 'skipped' } } as const;
  return { ...moderation, outcome: 'rejected', reasons: ['duplicate'], blur: null, checks };
}

// The judge's veto: it names the photo not_waste. The fixture's reason describes waste, so none is quoted.
function notWasteView(verification: VerificationEvidence): VerificationEvidence {
  const signals = verification.signals?.map((signal) => (signal.name === 'vision_judge' ? { ...signal, score: 0.1 } : signal));
  return { ...verification, decision: 'rejected', judge: { report_type: 'not_waste', rationale: '' }, signals };
}

const FRAME_VIEWS: Readonly<Partial<Record<FrameFinding['result'], FrameView>>> = {
  waiting: (set, frame) => ({
    status: 'unverified',
    moderation: set.moderation,
    verification: { ...set.verification, judge: set.verification.judge && { ...set.verification.judge, report_type: frame.report_type } },
  }),
  skipped: (set) => ({ status: 'rejected', moderation: repeatView(set.moderation), verification: null }),
  not_waste: (set) => ({ status: 'rejected', moderation: set.moderation, verification: notWasteView(set.verification) }),
};

/**
 * Mock mode's evidence for GET /reports/{id}: a sample snap reads the jdh-1 fixtures, and each frame of
 * a sample scan reads the jpr-1 fixtures, shaped to the result the scan listed for it.
 */
export class MockReportEvidence {
  readonly #loaders: ReportEvidenceLoaders;
  readonly #frames = new Map<string, FrameFinding>();

  constructor(loaders: ReportEvidenceLoaders) {
    this.#loaders = loaders;
  }

  noteFrames(frames: readonly FrameFinding[]): void {
    frames.forEach((frame) => this.#frames.set(frame.report_id, frame));
  }

  /** The frame's status with its evidence, or null when the id is not a sample frame. */
  async frame(reportId: string, updatedAt: string): Promise<ReportStatusView | null> {
    const frame = this.#frames.get(reportId);
    const shape = frame && FRAME_VIEWS[frame.result];
    if (!frame || !shape) return null;
    const set = await this.#loaders.frame();
    const report = { ...set.report, report_type: frame.report_type };
    const base = { report_id: reportId, site_id: frame.site_id, blurred_url: frame.blurred_url, updated_at: updatedAt, report };
    return { ...base, ...shape(set, frame) };
  }

  /** A sample snap's final status with the jdh-1 evidence. */
  async snap(view: ReportStatusView): Promise<ReportStatusView> {
    const set = await this.#loaders.snap();
    return { ...view, ...set };
  }
}
