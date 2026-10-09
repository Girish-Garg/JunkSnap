import type { ReportUpload } from "../contracts/index.gen.js";
import type { FrameHash } from "./FrameHash.js";

export type FramePosition = ReportUpload["gps"];

export interface PlannedFrame {
  readonly tMs: number;
  readonly hintScore?: number;
}

export interface LocatedFrame extends PlannedFrame {
  readonly gps: FramePosition;
}

export interface CandidateFrame extends LocatedFrame {
  readonly path: string;
  readonly hash: FrameHash;
}
