import type { PhotoFlag } from "../../contracts/index.gen.js";
import { JunkSnapError, type ErrorCode } from "../errors.js";

export type FlagReason = PhotoFlag["reason"];
export type FlagTextStatus = PhotoFlag["text_status"];
export type FlagModeration = PhotoFlag["moderation"];
export type PhotoFlagState = PhotoFlag["photo"];

// One person's latest report of one photo, as the notes table keeps it: hashes only, never the user id or device token.
export interface StoredPhotoFlag {
  readonly siteId: string;
  readonly photoId: string;
  readonly authorHash: string;
  readonly deviceHash: string;
  readonly reason: FlagReason;
  // Null without a description, or when moderation hid it: hidden text is never stored.
  readonly text: string | null;
  readonly textStatus: FlagTextStatus;
  readonly moderation: FlagModeration;
  readonly createdAt: string;
}

// Who stands behind one stored report: each user once (the row key) and each device once.
export interface FlagAuthor {
  readonly authorHash: string;
  readonly deviceHash: string;
}

// Decision 20261011-0310-hem-photo-flags: nobody reports their own photo.
export class OwnPhotoError extends JunkSnapError {
  override readonly code: ErrorCode = "own_photo";
}
