import type { CheckItem, CheckMark, CheckName, ChecklistRule, EvidenceBand } from './FeedbackChecklist';
import type { ModerationEvidence, ModerationReason, SignalEvidence, SignalName } from './ReportEvidence';
import type { ReportStatusView } from './ReportStatus';

// Support at or above this counts as agreeing with the claim; at least STRONG_GAP away from it is a firm answer.
const AGREES = 0.5;
const STRONG_GAP = 0.3;
// The report types our trained detector has classes for (backend/ml yolo_signal.py CLAIM_EVIDENCE).
// It has no class for contaminated water or construction debris (issue 111), so those claims are not judged by it.
const DETECTOR_TYPES: ReadonlySet<string> = new Set(['waste_dump', 'no_bin', 'overflowing_bin']);
const CAMERA_MODES: ReadonlySet<string> = new Set(['snap', 'scan']);
const CAMERA_REASONS: ReadonlySet<ModerationReason> = new Set(['invalid_image', 'stale_timestamp', 'blocked_device']);

function check(name: CheckName, mark: CheckMark, variant: string, band: EvidenceBand | null = null): CheckItem {
  return { name, mark, variant, band };
}

function bandOf(score: number): EvidenceBand {
  return Math.abs(score - AGREES) >= STRONG_GAP ? 'strong' : 'weak';
}

function scored(name: CheckName, score: number): CheckItem {
  return score >= AGREES ? check(name, 'pass', 'pass', bandOf(score)) : check(name, 'fail', 'fail', bandOf(score));
}

// A model check with no verification yet: still to come, or never, when moderation stopped the photo first.
function notYet(view: ReportStatusView, name: CheckName): CheckItem {
  return view.moderation?.outcome === 'rejected' ? check(name, 'skip', 'stopped', 'not_used') : check(name, 'skip', 'pending');
}

function signal(view: ReportStatusView, name: SignalName): SignalEvidence | undefined {
  return view.verification?.signals?.find((entry) => entry.name === name);
}

/** The photo came from the in-app camera, fresh, from a device in good standing, with matching bytes. */
export class AuthenticRule implements ChecklistRule {
  item(view: ReportStatusView): CheckItem {
    const moderation = view.moderation;
    if (!moderation) return check('authentic', 'skip', 'pending');
    if (AuthenticRule.#failed(view, moderation)) return check('authentic', 'fail', 'fail');
    return AuthenticRule.#passed(moderation) ? check('authentic', 'pass', 'pass') : check('authentic', 'skip', 'not_reached');
  }

  static #failed(view: ReportStatusView, moderation: ModerationEvidence): boolean {
    const mode = view.report?.capture_mode;
    if (mode !== undefined && !CAMERA_MODES.has(mode)) return true;
    return moderation.reasons?.some((reason) => CAMERA_REASONS.has(reason)) ?? false;
  }

  // Moderation stops at its first failed check, so a passed photo passed them all.
  static #passed(moderation: ModerationEvidence): boolean {
    if (moderation.outcome === 'passed') return true;
    const checks = moderation.checks;
    return checks?.fresh_timestamp?.result === 'pass' && checks.device_token?.result === 'pass';
  }
}

/** Faces and number plates blurred before any public copy existed. */
export class BlurRule implements ChecklistRule {
  item(view: ReportStatusView): CheckItem {
    const moderation = view.moderation;
    if (!moderation) return check('blurred', 'skip', 'pending');
    if (moderation.blur || moderation.outcome === 'passed') return check('blurred', 'pass', 'pass');
    return check('blurred', 'skip', 'never_shown');
  }
}

/** The detector's view of the claimed type, or why it had none. */
export class DetectorRule implements ChecklistRule {
  item(view: ReportStatusView): CheckItem {
    if (!DetectorRule.#trained(view)) return check('detector', 'skip', 'untrained', 'not_used');
    if (!view.verification) return notYet(view, 'detector');
    const found = signal(view, 'yolo') ?? signal(view, 'rekognition_labels');
    return found ? scored('detector', found.score) : check('detector', 'skip', 'not_run', 'not_used');
  }

  static #trained(view: ReportStatusView): boolean {
    const type = view.report?.report_type ?? view.verification?.judge?.report_type;
    return type === undefined || DETECTOR_TYPES.has(type);
  }
}

/** The vision judge on the blurred photo: agreed, disagreed, or did not run. */
export class JudgeRule implements ChecklistRule {
  item(view: ReportStatusView): CheckItem {
    const verification = view.verification;
    if (!verification) return notYet(view, 'judge');
    if (!verification.judge) return check('judge', 'skip', 'not_run', 'not_used');
    const score = signal(view, 'vision_judge')?.score;
    if (score !== undefined && verification.judge.report_type !== 'not_waste') return scored('judge', score);
    const band = score === undefined ? null : bandOf(score);
    return verification.judge.report_type === 'not_waste' ? check('judge', 'fail', 'fail', band) : check('judge', 'pass', 'pass');
  }
}

/** Inside India, with the phone's GPS accuracy in whole metres. */
export class LocationRule implements ChecklistRule {
  item(view: ReportStatusView): CheckItem {
    const moderation = view.moderation;
    if (!moderation) return check('location', 'skip', 'pending');
    if (LocationRule.#outside(moderation)) return check('location', 'fail', 'fail');
    const checked = moderation.outcome === 'passed' || moderation.checks?.inside_india?.result === 'pass';
    return checked ? LocationRule.#checked(view) : check('location', 'skip', 'not_reached');
  }

  static #outside(moderation: ModerationEvidence): boolean {
    return moderation.checks?.inside_india?.result === 'fail' || (moderation.reasons?.includes('outside_india') ?? false);
  }

  static #checked(view: ReportStatusView): CheckItem {
    const accuracy = view.verification?.features?.gps_accuracy_m ?? view.report?.gps?.accuracy_m;
    if (accuracy === undefined) return check('location', 'pass', 'pass_plain');
    return { ...check('location', 'pass', 'pass'), metres: Math.max(1, Math.round(accuracy)) };
  }
}
