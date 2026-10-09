import type { ScanSession } from "../contracts/scanSessionPending.js";
import type { ScanFrameCounts } from "../domain/ScanRecord.js";
import type { CandidateFrame, LocatedFrame, PlannedFrame } from "../domain/ScanFrame.js";
import { InvalidVideoError } from "../domain/scanErrors.js";
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

  async sample(scan: ScanSession, videoPath: string, workDir: string): Promise<SampledFrames> {
    const planned = this.#tools.planner.plan(scan.duration_ms, scan.hints?.detections ?? []);
    const located = ScanFrameSampler.#locate(planned, new GpsInterpolator(scan.gps_track));
    const times = located.map((frame) => frame.tMs);
    const extracted = await this.#tools.reader.extract(videoPath, times, workDir);
    if (located.length > 0 && extracted.length === 0) {
      throw new InvalidVideoError("no frame could be cut from the video");
    }
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

  async #hash(located: readonly LocatedFrame[], extracted: readonly ExtractedFrame[]): Promise<CandidateFrame[]> {
    const byTime = new Map(located.map((frame) => [frame.tMs, frame]));
    const pairs = extracted.flatMap((cut) => {
      const frame = byTime.get(cut.tMs);
      return frame === undefined ? [] : [{ frame, path: cut.path }];
    });
    return Promise.all(
      pairs.map(async ({ frame, path }) => ({ ...frame, path, hash: await this.#tools.hasher.hash(path) })),
    );
  }
}
