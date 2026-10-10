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
  /** The phone's list token is missing or names another account, so its sent rows may not be this account's. */
  readonly ownerChanged: boolean;
  /** Rows saved at or after this time (ms) were made in this sign-in, so they are the current account's. */
  readonly ownedSince: number;
  /** Report ids the reporter deleted from Activity; the listing never brings them back. */
  readonly dismissed: ReadonlySet<string>;
}

export interface MergePlan {
  readonly save: readonly QueuedReport[];
  readonly remove: readonly string[];
}

/**
 * Folds the server's list into this phone's rows. A listed report updates its row when its updated_at changed,
 * or becomes a new row; a withdrawn report never becomes a new row. A sent row the listing lacks is dropped:
 * always when the owner changed (complete listing or not; rows made in this sign-in stay), else only when the
 * listing is complete and the server listed it before. Unsent rows always stay.
 */
export class ActivityMerge {
  static plan(local: readonly QueuedReport[], listing: ActivityListing, context: MergeContext): MergePlan {
    const byReportId = new Map(local.flatMap((row) => (row.data.report_id ? [[row.data.report_id, row] as const] : [])));
    const byId = new Map(local.map((row) => [row.id, row] as const));
    const shown = listing.views.filter((view) => !context.dismissed.has(view.report_id));
    const save = shown.flatMap((view) => ActivityMerge.#update(byReportId.get(view.report_id) ?? byId.get(ListedReport.rowId(view)), view, context.now));
    const listed = new Set(listing.views.map((view) => view.report_id));
    const remove = local.filter((row) => ActivityMerge.#gone(row, listed, listing.complete, context)).map((row) => row.id);
    return { save, remove };
  }

  static #update(row: QueuedReport | undefined, view: ReportStatusView, now: Date): readonly QueuedReport[] {
    if (!row) {
      if (view.status === 'withdrawn') return [];
      const created = ListedReport.toQueued(view, now);
      return created ? [created] : [];
    }
    const fresh = row.data.synced_at !== undefined && row.data.status?.updated_at === view.updated_at;
    return fresh || row.isPending() ? [] : [row.synced(view, now)];
  }

  static #gone(row: QueuedReport, listed: ReadonlySet<string>, complete: boolean, context: MergeContext): boolean {
    const reportId = row.data.report_id;
    if (row.data.stage !== 'sent' || reportId === null || listed.has(reportId)) return false;
    if (context.ownerChanged) return Date.parse(row.data.saved_at) < context.ownedSince;
    return complete && row.data.synced_at !== undefined;
  }
}
