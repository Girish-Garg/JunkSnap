import { ListedReport } from './ReportList';
import type { QueuedReport } from './QueuedReport';
import type { ReportStatusView } from './ReportStatus';

export interface ActivityListing {
  /** Every report the server listed for the signed-in user, newest first. */
  readonly views: readonly ReportStatusView[];
  /** True when every page was read, so a report missing from views is truly gone. */
  readonly complete: boolean;
}

export interface MergeContext {
  readonly now: Date;
  /** The rows on this phone were last synced for a different account. */
  readonly ownerChanged: boolean;
  /** Report ids the reporter deleted from Activity; the listing never brings them back. */
  readonly dismissed: ReadonlySet<string>;
}

export interface MergePlan {
  readonly save: readonly QueuedReport[];
  readonly remove: readonly string[];
}

/**
 * Folds the server's list into this phone's rows. A listed report updates its row when its updated_at
 * changed, or becomes a new row. A sent row the complete listing lacks is dropped when the server
 * listed it before or another account's rows are on the phone; unsent rows always stay.
 */
export class ActivityMerge {
  static plan(local: readonly QueuedReport[], listing: ActivityListing, context: MergeContext): MergePlan {
    const byReportId = new Map(local.flatMap((row) => (row.data.report_id ? [[row.data.report_id, row] as const] : [])));
    const byId = new Map(local.map((row) => [row.id, row] as const));
    const shown = listing.views.filter((view) => !context.dismissed.has(view.report_id));
    const save = shown.flatMap((view) => ActivityMerge.#update(byReportId.get(view.report_id) ?? byId.get(ListedReport.rowId(view)), view, context.now));
    const listed = new Set(listing.views.map((view) => view.report_id));
    const remove = local.filter((row) => ActivityMerge.#gone(row, listed, listing.complete, context.ownerChanged)).map((row) => row.id);
    return { save, remove };
  }

  static #update(row: QueuedReport | undefined, view: ReportStatusView, now: Date): readonly QueuedReport[] {
    if (!row) {
      const created = ListedReport.toQueued(view, now);
      return created ? [created] : [];
    }
    const fresh = row.data.synced_at !== undefined && row.data.status?.updated_at === view.updated_at;
    return fresh || row.isPending() ? [] : [row.synced(view, now)];
  }

  static #gone(row: QueuedReport, listed: ReadonlySet<string>, complete: boolean, ownerChanged: boolean): boolean {
    const reportId = row.data.report_id;
    if (!complete || row.data.stage !== 'sent' || reportId === null || listed.has(reportId)) return false;
    return ownerChanged || row.data.synced_at !== undefined;
  }
}
