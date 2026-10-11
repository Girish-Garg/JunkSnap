import { spawn, type ChildProcessByStdio } from "node:child_process";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { Readable } from "node:stream";
import { ExternalServiceError } from "../domain/errors.js";
import { InvalidVideoError } from "../domain/scanErrors.js";
import type { ExtractedFrame, VideoFrameReader, VideoInfo } from "../ports/VideoFrameReader.js";
import { FramecrcParser } from "./FramecrcParser.js";

const MS_PER_SECOND = 1_000;
// A minute of video at 240 fps lists in about 1 MB, so more than this is not a phone recording.
const MAX_STDOUT_CHARS = 16_000_000;
const MAX_STDERR_CHARS = 4_000;

interface FfmpegRun {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly truncated: boolean;
}

export interface FfmpegOptions {
  readonly binary?: string;
  // FFMPEG_TIMEOUT_MS.
  readonly timeoutMs: number;
}

export class FfmpegVideoFrameReader implements VideoFrameReader {
  readonly #binary: string;
  readonly #timeoutMs: number;
  readonly #parser = new FramecrcParser();

  constructor({ binary = "ffmpeg", timeoutMs }: FfmpegOptions) {
    this.#binary = binary;
    this.#timeoutMs = timeoutMs;
  }

  // Lists the video packets with -c copy: exact timestamps without decoding a single frame.
  async probe(videoPath: string): Promise<VideoInfo> {
    const args = ["-v", "error", "-i", videoPath, "-map", "0:v:0", "-c", "copy", "-f", "framecrc", "-"];
    const run = await this.#run(args);
    const info = run.exitCode === 0 && !run.truncated ? this.#parser.parse(run.stdout) : undefined;
    if (info === undefined) {
      throw new InvalidVideoError("The file holds no readable video stream");
    }
    return info;
  }

  async extract(videoPath: string, timesMs: readonly number[], outDir: string): Promise<ExtractedFrame[]> {
    const frames: ExtractedFrame[] = [];
    for (const tMs of timesMs) {
      frames.push(await this.#cut(videoPath, tMs, outDir));
    }
    return frames;
  }

  // Seeking before -i is fast and frame-accurate: the cut is the first frame at or after tMs.
  async #cut(videoPath: string, tMs: number, outDir: string): Promise<ExtractedFrame> {
    const path = join(outDir, `frame-${tMs}.jpg`);
    const seconds = (tMs / MS_PER_SECOND).toFixed(3);
    const args = ["-v", "error", "-ss", seconds, "-i", videoPath, "-frames:v", "1", "-update", "1", "-q:v", "2", "-y", path];
    const run = await this.#run(args);
    if (run.exitCode !== 0 || !(await FfmpegVideoFrameReader.#written(path))) {
      const reason = run.stderr.trim().split("\n").at(-1) ?? "";
      throw new ExternalServiceError(`ffmpeg could not cut the frame at ${tMs} ms (exit ${run.exitCode}): ${reason}`);
    }
    return { tMs, path };
  }

  // A run stopped by the time limit or any signal throws ExternalServiceError, so SQS retries the scan.
  #run(args: readonly string[]): Promise<FfmpegRun> {
    return new Promise((resolve, reject) => {
      const limits = { timeout: this.#timeoutMs, killSignal: "SIGKILL" } as const;
      const child = spawn(this.#binary, args, { stdio: ["ignore", "pipe", "pipe"], ...limits });
      const output = FfmpegVideoFrameReader.#collect(child);
      child.on("error", (error) => {
        reject(new ExternalServiceError(`Could not start ${this.#binary}`, { cause: error }));
      });
      child.on("close", (code, signal) => {
        if (signal !== null) {
          reject(new ExternalServiceError(`${this.#binary} was stopped by ${signal}; the time limit is ${this.#timeoutMs} ms`));
          return;
        }
        resolve({ exitCode: code ?? -1, ...output() });
      });
    });
  }

  // Keeps stdout whole up to its cap and only the tail of stderr, where ffmpeg puts the reason it failed.
  static #collect(child: ChildProcessByStdio<null, Readable, Readable>): () => Omit<FfmpegRun, "exitCode"> {
    const stdout: string[] = [];
    let chars = 0;
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      chars += chunk.length;
      if (chars <= MAX_STDOUT_CHARS) {
        stdout.push(chunk);
      }
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-MAX_STDERR_CHARS);
    });
    return () => ({ stdout: stdout.join(""), stderr, truncated: chars > MAX_STDOUT_CHARS });
  }

  static async #written(path: string): Promise<boolean> {
    try {
      return (await stat(path)).size > 0;
    } catch {
      return false;
    }
  }
}
