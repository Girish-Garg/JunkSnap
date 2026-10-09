import { ValidationError } from "../errors.js";

const REPORT_ID = /^rpt_[a-z0-9_]{1,40}$/;

// The public blurred copy of a report photo; the key is derived, so no original can be named here.
export class BlurredImage {
  readonly reportId: string;
  readonly key: string;

  constructor(reportId: string) {
    if (!REPORT_ID.test(reportId)) {
      throw new ValidationError(`not a report id: ${reportId}`);
    }
    this.reportId = reportId;
    this.key = `media/reports/${reportId}.jpg`;
  }
}
