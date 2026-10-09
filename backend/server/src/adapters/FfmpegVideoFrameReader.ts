import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { ExternalServiceError } from "../domain/errors.js";
import { InvalidVideoError } from "../domain/scanErrors.js";
import type { ExtractedFrame, VideoFrameReader, VideoSize } from "../ports/VideoFrameReader.js";

// Matches "Video: vp9 (Profile 0), yuv420p(tv), 1280x720," in ffmpeg's stream listing.
const VIDEO_STREAM_SIZE = /Video:.*?\b(\d{2,5})x(\d{2,5})\b/;
const MS_PER_SECOND = 1_000;
const MAX_STDERR_CHARS = 20_000;

interface FfmpegRun {
  readonly exitCode: number;
  readonly stderr: string;
}

export class FfmpegVideoFrameReader implements VideoFrameReader {
  readonly #binary: string;

  constructor(binary = "ffmpeg") {
    this.#binary = binary;
  }

  // Without an output file ffmpeg exits 1 after listing the streams, which is all this needs.
  async probe(videoPath: string): Promise<VideoSize> {
    const { stderr } = await this.#run(["-hide_banner", "-i", videoPath]);
    const match = VIDEO_STREAM_SIZE.exec(stderr);
    if (match === null) {
      throw new InvalidVideoError("The file holds no readable video stream");
    }
    return { width: Number(match[1]), height: Number(match[2]) };
  }

  async extract(videoPath: string, timesMs: readonly number[], outDir: string): Promise<ExtractedFrame[]> {
    const frames: ExtractedFrame[] = [];
    for (const tMs of timesMs) {
      const path = join(outDir, `frame-${tMs}.jpg`);
      if (await this.#cut(videoPath, tMs, path)) {
        frames.push({ tMs, path });
      }
    }
    return frames;
  }

  // Seeking before -i is fast and still frame-accurate; past the end ffmpeg exits non-zero and writes nothing.
  async #cut(videoPath: string, tMs: number, path: string): Promise<boolean> {
    const seconds = (tMs / MS_PER_SECOND).toFixed(3);
    const args = ["-v", "error", "-ss", seconds, "-i", videoPath, "-frames:v", "1", "-update", "1", "-q:v", "2", "-y", path];
    const { exitCode } = await this.#run(args);
    return exitCode === 0 && (await FfmpegVideoFrameReader.#exists(path));
  }

  #run(args: readonly string[]): Promise<FfmpegRun> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.#binary, args, { stdio: ["ignore", "ignore", "pipe"] });
      let stderr = "";
      child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
        stderr = (stderr + chunk).slice(0, MAX_STDERR_CHARS);
      });
      child.on("error", (error) => {
        reject(new ExternalServiceError(`Could not start ${this.#binary}`, { cause: error }));
      });
      child.on("close", (code) => {
        resolve({ exitCode: code ?? -1, stderr });
      });
    });
  }

  static async #exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }
}
