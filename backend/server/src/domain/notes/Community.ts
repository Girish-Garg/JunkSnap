import type { Site, SiteNote } from "../../contracts/index.gen.js";

export type Community = NonNullable<Site["properties"]["community"]>;
export type CommunitySignals = Community["signals"];
export type NoteLanguage = SiteNote["language"];
export type NoteModeration = SiteNote["moderation"];

export const SIGNAL_FLAGS = [
  "recurring",
  "burning",
  "smell",
  "blocked_drain",
  "animals",
  "near_school",
  "near_hospital",
  "access_issue",
] as const;

export type SignalFlag = (typeof SIGNAL_FLAGS)[number];

// A moderated note that may be read: its text and a hash of who wrote it (never shown).
export interface ShownNote {
  readonly text: string;
  readonly authorHash: string;
  // A photo report's description (decision 20261011-0310-hem-photo-flags): a neutral signal, never counted as a note.
  readonly source?: "photo_report";
}

export interface StoredNote {
  readonly noteId: string;
  readonly siteId: string;
  readonly authorHash: string;
  // Null when moderation hid the note: hidden text is never stored.
  readonly text: string | null;
  readonly language: NoteLanguage;
  readonly moderation: NoteModeration;
  readonly createdAt: string;
}

export function flagged(signals: CommunitySignals, flag: SignalFlag): boolean {
  return signals[flag] === true;
}
