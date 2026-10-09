import type { ReportUpload, ScanSession } from "../contracts/index.gen.js";
import type { FrameHash } from "./FrameHash.js";

export type FramePosition = ReportUpload["gps"];
export type GpsFix = ScanSession["gps_track"][number];
export type ScanDetection = NonNullable<ScanSession["hints"]>["detections"][number];

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
