import type { LetterDraft, Site } from "../../contracts/index.gen.js";

export type Channel = LetterDraft["channel"];
export type Language = LetterDraft["language"];
export type Citation = LetterDraft["citations"][number];
export type CcLine = LetterDraft["cc"][number];
export type Recipient = LetterDraft["to"];
export type ReportType = Site["properties"]["report_type"];
export type SiteContext = Site["properties"]["context"];

export interface Provenance {
  readonly provider: LetterDraft["provider"];
  readonly model: string;
  readonly version: string;
}

export interface SeatRef {
  readonly id: string;
  readonly name: string;
}

export interface Addressees {
  readonly channel: Channel;
  readonly to: Recipient;
  readonly cc: readonly CcLine[];
  readonly filingUrl: string | null;
}

export interface Prose {
  readonly subject: string;
  readonly body: string;
}

export interface Requester {
  readonly deviceToken: string;
  // Null until the auth task's requireUser supplies it.
  readonly userId: string | null;
}
