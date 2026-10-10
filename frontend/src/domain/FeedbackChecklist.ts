import { AuthenticRule, BlurRule, DetectorRule, JudgeRule, LocationRule } from './FeedbackRules';
import type { ReportStatusView } from './ReportStatus';

/** ✓ pass, ✗ fail, – not run, not reached or not needed. */
export type CheckMark = 'pass' | 'fail' | 'skip';

/** How firm a model's answer was, in words instead of a score. */
export type EvidenceBand = 'strong' | 'weak' | 'not_used';

export type CheckName = 'authentic' | 'blurred' | 'detector' | 'judge' | 'location';

export interface CheckItem {
  readonly name: CheckName;
  readonly mark: CheckMark;
  /** The line to show, under feedback.check.<name>.<variant> in the i18n files. */
  readonly variant: string;
  /** Only model checks carry a band; null for rule checks such as blurring. */
  readonly band: EvidenceBand | null;
  /** GPS accuracy in whole metres, for the location line. */
  readonly metres?: number;
}

export interface ChecklistRule {
  item(view: ReportStatusView): CheckItem;
}

const RULES: readonly ChecklistRule[] = [new AuthenticRule(), new BlurRule(), new DetectorRule(), new JudgeRule(), new LocationRule()];

/** The reporter's checklist, built only from the evidence GET /reports/{id} returns. */
export class FeedbackChecklist {
  static of(view: ReportStatusView): readonly CheckItem[] {
    return RULES.map((rule) => rule.item(view));
  }
}
