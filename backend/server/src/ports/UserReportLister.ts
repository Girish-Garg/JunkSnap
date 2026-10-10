import type { Report } from "../domain/Report.js";

export interface UserReportPageRequest {
  readonly limit: number;
  /** The opaque next_cursor of the page before, or null for the newest page. */
  readonly cursor: string | null;
}

export interface UserReportPage {
  readonly reports: readonly Report[];
  readonly nextCursor: string | null;
}

// One user's Snap reports (photos and no-bin), newest received first; scan frames are left out.
export interface UserReportLister {
  page(userId: string, request: UserReportPageRequest): Promise<UserReportPage>;
}
