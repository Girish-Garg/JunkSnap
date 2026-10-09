import type { ScanSession } from "../contracts/index.gen.js";
import { InvalidVideoError } from "../domain/scanErrors.js";
import { SCAN_VIDEO_LIMITS } from "../domain/scanLimits.js";
import type { ScanMediaStore } from "../ports/ScanMediaStore.js";
import type { VideoFrameReader, VideoInfo } from "../ports/VideoFrameReader.js";

export class ScanVideoLoader {
  readonly #media: ScanMediaStore;
  readonly #reader: VideoFrameReader;

  constructor(media: ScanMediaStore, reader: VideoFrameReader) {
    this.#media = media;
    this.#reader = reader;
  }

  // Checks the real bytes, size and length, never the phone's claims about them.
  async load(scan: ScanSession, videoPath: string): Promise<VideoInfo> {
    const video = await this.#media.downloadVideo(scan.video_key, videoPath);
    if (video.bytes > SCAN_VIDEO_LIMITS.maxBytes) {
      throw new InvalidVideoError(`video is ${video.bytes} bytes; the limit is ${SCAN_VIDEO_LIMITS.maxBytes}`);
    }
    if (video.sha256Hex !== scan.video_sha256) {
      throw new InvalidVideoError("video bytes do not match video_sha256");
    }
    const info = await this.#reader.probe(videoPath);
    ScanVideoLoader.#checkSize(info);
    if (info.lastFrameMs > SCAN_VIDEO_LIMITS.maxDurationMs) {
      throw new InvalidVideoError(`video has frames at ${info.lastFrameMs} ms; the limit is ${SCAN_VIDEO_LIMITS.maxDurationMs} ms`);
    }
    return info;
  }

  // Either orientation: the long side at most 1280 px and the short side at most 720 px.
  static #checkSize({ width, height }: VideoInfo): void {
    const fits =
      Math.max(width, height) <= SCAN_VIDEO_LIMITS.maxLongSidePx &&
      Math.min(width, height) <= SCAN_VIDEO_LIMITS.maxShortSidePx;
    if (!fits) {
      throw new InvalidVideoError(`video is ${width}x${height}; the limit is 1280 by 720`);
    }
  }
}
