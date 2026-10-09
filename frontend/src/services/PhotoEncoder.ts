import { CaptureError } from '../domain/CaptureError';

const MAX_EDGE_PX = 2048;
const JPEG_QUALITY = 0.85;

export interface ImageEncoder {
  fromVideo(video: HTMLVideoElement): Promise<ArrayBuffer>;
  fromFile(file: Blob): Promise<ArrayBuffer>;
}

/** Every capture becomes a JPEG of at most 2048 px: small on mobile data, no EXIF, under the 8 MB limit. */
export class PhotoEncoder implements ImageEncoder {
  fromVideo(video: HTMLVideoElement): Promise<ArrayBuffer> {
    return PhotoEncoder.#encode(video, video.videoWidth, video.videoHeight);
  }

  async fromFile(file: Blob): Promise<ArrayBuffer> {
    const bitmap = await createImageBitmap(file);
    try {
      return await PhotoEncoder.#encode(bitmap, bitmap.width, bitmap.height);
    } finally {
      bitmap.close();
    }
  }

  static async #encode(source: CanvasImageSource, width: number, height: number): Promise<ArrayBuffer> {
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(width, height, 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    if (!context || canvas.width === 0) throw new CaptureError('encode_failed', 'No camera frame to save');
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new CaptureError('encode_failed', 'The browser could not make a JPEG');
    return blob.arrayBuffer();
  }
}
