import { JudgeRule } from './FeedbackRules';
import { ModelLabel } from './ModelLabel';
import { RationaleSanitizer } from './RationaleSanitizer';
import type { ReportStatusView } from './ReportStatus';

/** What the vision judge said about the reporter's own blurred photo, made safe to show them. */
export interface JudgeQuoteView {
  /** The cleaned reason, or null when it failed the guard; the view then shows a generic line. */
  readonly text: string | null;
  readonly agreed: boolean;
  /** The judge's provider and model from the evidence; null for evidence without a vision_judge signal. */
  readonly label: ModelLabel | null;
}

export class JudgeQuote {
  /** Null when the judge did not run, so there is nothing to quote. */
  static of(view: ReportStatusView): JudgeQuoteView | null {
    const judge = view.verification?.judge;
    if (!judge) return null;
    const signal = view.verification?.signals?.find((entry) => entry.name === 'vision_judge');
    return {
      text: RationaleSanitizer.clean(judge.rationale),
      agreed: new JudgeRule().item(view).mark === 'pass',
      label: signal ? new ModelLabel(signal) : null,
    };
  }
}
