import type { ScanSession } from "../contracts/index.gen.js";
import { InvalidVideoError } from "../domain/scanErrors.js";
import type { ScanVideoLimits } from "../domain/scanLimits.js";
import type { ScanMediaStore } from "../ports/ScanMediaStore.js";
import type { VideoFrameReader, VideoInfo } from "../ports/VideoFrameReader.js";

export class ScanVideoLoader {
  readonly #media: ScanMediaStore;
  readonly #reader: VideoFrameReader;
  readonly #limits: ScanVideoLimits;

  constructor(media: ScanMediaStore, reader: VideoFrameReader, limits: ScanVideoLimits) {
    this.#media = media;
    this.#reader = reader;
    this.#limits = limits;
  }

  // Checks the real bytes, size and length, never the phone's claims about them.
  async load(scan: ScanSession, videoPath: string): Promise<VideoInfo> {
    const video = await this.#media.downloadVideo(scan.video_key, videoPath);
    const { maxBytes, maxDurationMs } = this.#limits;
    if (video.bytes > maxBytes) {
      throw new InvalidVideoError(`video is ${video.bytes} bytes; the limit is ${maxBytes}`);
    }
    if (video.sha256Hex !== scan.video_sha256) {
      throw new InvalidVideoError("video bytes do not match video_sha256");
    }
    const info = await this.#reader.probe(videoPath);
    this.#checkSize(info);
    if (info.lastFrameMs > maxDurationMs) {
      throw new InvalidVideoError(`video has frames at ${info.lastFrameMs} ms; the limit is ${maxDurationMs} ms`);
    }
    return info;
  }

  // Either orientation: the long side at most SCAN_MAX_LONG_SIDE_PX and the short side at most SCAN_MAX_SHORT_SIDE_PX.
  #checkSize({ width, height }: VideoInfo): void {
    const { maxLongSidePx, maxShortSidePx } = this.#limits;
    const fits = Math.max(width, height) <= maxLongSidePx && Math.min(width, height) <= maxShortSidePx;
    if (!fits) {
      throw new InvalidVideoError(`video is ${width}x${height}; the limit is ${maxLongSidePx} by ${maxShortSidePx}`);
    }
  }
}
