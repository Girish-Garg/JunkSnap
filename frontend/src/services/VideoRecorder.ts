import { CaptureError } from '../domain/CaptureError';
import type { VideoType } from '../domain/ScanUpload';
import type { Clock } from './Clock';
import { RecordingSession } from './RecordingSession';

// MP4 (H.264) where the browser records it, else WebM; both are allowed scan video types.
const PREFERRED_TYPES = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
] as const;

// 2.5 Mbit/s makes a full minute about 19 MB, half the 40 MB limit, with room for encoder overshoot.
export const VIDEO_BITS_PER_SECOND = 2_500_000;

export type RecorderFactory = {
  new (stream: MediaStream, options?: MediaRecorderOptions): MediaRecorder;
  isTypeSupported(type: string): boolean;
};

/** Starts MediaRecorder sessions on the viewfinder stream. */
export class VideoRecorder {
  readonly #factory: RecorderFactory | undefined;
  readonly #clock: Clock;

  constructor(factory: RecorderFactory | undefined, clock: Clock) {
    this.#factory = factory;
    this.#clock = clock;
  }

  isSupported(): boolean {
    return this.#factory !== undefined && this.pickType() !== null;
  }

  pickType(): string | null {
    return PREFERRED_TYPES.find((type) => this.#factory?.isTypeSupported(type)) ?? null;
  }

  /** Records at most 60 s and stops early before 40 MB. */
  start(stream: MediaStream): RecordingSession {
    const mimeType = this.pickType();
    if (!this.#factory || !mimeType) throw new CaptureError('recorder_unsupported', 'This browser cannot record video');
    const recorder = new this.#factory(stream, { mimeType, videoBitsPerSecond: VIDEO_BITS_PER_SECOND });
    return new RecordingSession(recorder, VideoRecorder.baseType(mimeType), this.#clock);
  }

  /** The container type without codecs, as the api expects it. */
  static baseType(mimeType: string): VideoType {
    return mimeType.split(';')[0]?.trim() === 'video/mp4' ? 'video/mp4' : 'video/webm';
  }
}
