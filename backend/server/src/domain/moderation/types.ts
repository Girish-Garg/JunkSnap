import type { ModerationResult } from "../../contracts/index.gen.js";
import type { Box } from "./Box.js";

export type RejectReason = ModerationResult["reasons"][number];
export type CheckKey = keyof ModerationResult["checks"];
export type CheckRecord = ModerationResult["checks"]["inside_india"];
export type Provider = ModerationResult["image_moderation"]["provider"];
export type NoteVerdict = NonNullable<ModerationResult["note_moderation"]>;

export interface ModelStamp {
  readonly provider: Provider;
  readonly model: string;
  readonly version: string;
}

// What one detector found, with the Rekognition operation names and model version.
export interface FoundRegions {
  readonly boxes: readonly Box[];
  readonly model: string;
  readonly version: string | null;
}
