import { Letterbox } from '../domain/Letterbox';
import type { FrameGrabber, GrabbedFrame } from './EdgeDetector';

type CreateBitmap = (source: HTMLVideoElement, options: ImageBitmapOptions) => Promise<ImageBitmap>;

/** Copies the current video frame into a small ImageBitmap (long side = model input) to transfer to the worker. */
export class BitmapFrameGrabber implements FrameGrabber {
  readonly #create: CreateBitmap;

  constructor(create: CreateBitmap) {
    this.#create = create;
  }

  async grab(video: HTMLVideoElement, letterboxSize: number): Promise<GrabbedFrame | null> {
    const { videoWidth: width, videoHeight: height } = video;
    if (width === 0 || height === 0 || video.readyState < 2) return null;
    const box = Letterbox.fit(width, height, letterboxSize);
    try {
      const bitmap = await this.#create(video, { resizeWidth: box.scaledWidth, resizeHeight: box.scaledHeight, resizeQuality: 'low' });
      return { bitmap, width, height };
    } catch {
      return null;
    }
  }
}
