import type { ScanSession } from "../contracts/index.gen.js";
import { InternalDataError } from "../domain/errors.js";
import type { ScanFrameCounts } from "../domain/ScanRecord.js";
import type { CandidateFrame, LocatedFrame, PlannedFrame } from "../domain/ScanFrame.js";
import type { ScanGpsLimits } from "../domain/scanLimits.js";
import type { FrameHasher } from "../ports/FrameHasher.js";
import type { ExtractedFrame, VideoFrameReader } from "../ports/VideoFrameReader.js";
import type { FramePlanner } from "./FramePlanner.js";
import type { FrameSelector } from "./FrameSelector.js";
import { GpsInterpolator } from "./GpsInterpolator.js";

export interface FrameTools {
  readonly reader: VideoFrameReader;
  readonly hasher: FrameHasher;
  readonly planner: FramePlanner;
  readonly selector: FrameSelector;
  readonly gps: ScanGpsLimits;
}

export interface VideoFile {
  readonly path: string;
  readonly lastFrameMs: number;
}

export interface SampledFrames {
  readonly frames: readonly CandidateFrame[];
  readonly counts: ScanFrameCounts;
}

export class ScanFrameSampler {
  readonly #tools: FrameTools;

  constructor(tools: FrameTools) {
    this.#tools = tools;
  }

  // Plans against the real video when it is shorter than the session claims, so every cut lands on a frame.
  async sample(scan: ScanSession, video: VideoFile, workDir: string): Promise<SampledFrames> {
    const durationMs = Math.min(scan.duration_ms, video.lastFrameMs + 1);
    const planned = this.#tools.planner.plan(durationMs, scan.hints?.detections ?? []);
    const located = ScanFrameSampler.#locate(planned, new GpsInterpolator(scan.gps_track, this.#tools.gps));
    const times = located.map((frame) => frame.tMs);
    const extracted = await this.#tools.reader.extract(video.path, times, workDir);
    const frames = this.#tools.selector.select(await this.#hash(located, extracted));
    const counts = { sampled: planned.length, kept: frames.length, dropped_no_fix: planned.length - located.length };
    return { frames, counts };
  }

  static #locate(planned: readonly PlannedFrame[], interpolator: GpsInterpolator): LocatedFrame[] {
    return planned.flatMap((frame) => {
      const gps = interpolator.locate(frame.tMs);
      return gps === undefined ? [] : [{ ...frame, gps }];
    });
  }

  // A frame the reader did not cut fails the whole scan rather than quietly shrinking it.
  async #hash(located: readonly LocatedFrame[], extracted: readonly ExtractedFrame[]): Promise<CandidateFrame[]> {
    const paths = new Map(extracted.map((cut) => [cut.tMs, cut.path]));
    return Promise.all(
      located.map(async (frame) => {
        const path = paths.get(frame.tMs);
        if (path === undefined) {
          throw new InternalDataError(`No frame was cut at ${frame.tMs} ms`);
        }
        return { ...frame, path, hash: await this.#tools.hasher.hash(path) };
      }),
    );
  }
}
