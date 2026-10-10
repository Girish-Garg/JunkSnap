// GET /me/reports (contracts/schemas/report_list.schema.json): the fields the app reads.
import { QueuedReport } from './QueuedReport';
import type { UploadEvidence } from './ReportEvidence';
import type { ReportStatusView } from './ReportStatus';
import { REPORT_TYPES } from './ReportType';
import type { GpsFix, ReportDraft } from './ReportUpload';
import type { SiteContext } from './Site';

export interface ReportListPage {
  readonly reports: readonly ReportStatusView[];
  readonly next_cursor: string | null;
}

/** One listed report as an Activity row: sent, with its status, on a phone that may never have held it. */
export class ListedReport {
  /** The row id: the photo's SHA-256 (the same id the phone gave it), else the report id for a no-bin report. */
  static rowId(view: ReportStatusView): string {
    return view.report?.sha256 ?? view.report_id;
  }

  /** Null when the listing lacks what a row shows (type, place, time). */
  static toQueued(view: ReportStatusView, now: Date): QueuedReport | null {
    const draft = view.report ? ListedReport.#draft(view.report) : null;
    if (draft === null) return null;
    return QueuedReport.fromData({
      id: ListedReport.rowId(view),
      stage: 'sent',
      draft,
      photo: null,
      upload: null,
      report_id: view.report_id,
      status: view,
      attempts: 0,
      put_refusals: 0,
      retry_at: null,
      problem: null,
      saved_at: view.received_at ?? draft.captured_at,
      synced_at: now.toISOString(),
    });
  }

  static #draft(report: UploadEvidence): ReportDraft | null {
    const type = REPORT_TYPES.find((each) => each === report.report_type);
    if (!type || !report.context || !report.captured_at) return null;
    return { report_type: type, context: report.context as SiteContext, sha256: report.sha256 ?? '', gps: ListedReport.#gps(report), captured_at: report.captured_at };
  }

  static #gps({ gps }: UploadEvidence): GpsFix {
    return { lat: gps?.lat ?? 0, lon: gps?.lon ?? 0, accuracy_m: gps?.accuracy_m ?? 0 };
  }
}
