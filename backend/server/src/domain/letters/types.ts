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

export interface AreaAddressees {
  readonly to: readonly Recipient[];
  readonly cc: readonly CcLine[];
}

export interface Prose {
  readonly subject: string;
  readonly body: string;
}

export interface Requester {
  readonly deviceToken: string;
  // The Cognito token's sub; letters need sign-in (decision 20261010-0227).
  readonly userId: string;
}
