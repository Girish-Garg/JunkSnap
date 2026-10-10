import { CaptureError } from '../domain/CaptureError';

const MAX_EDGE_PX = 2048;
const JPEG_QUALITY = 0.85;

export interface ImageEncoder {
  fromVideo(video: HTMLVideoElement): Promise<ArrayBuffer>;
}

/** Every capture becomes a JPEG of at most 2048 px: small on mobile data, no EXIF, under the 8 MB limit. */
export class PhotoEncoder implements ImageEncoder {
  async fromVideo(video: HTMLVideoElement): Promise<ArrayBuffer> {
    const { videoWidth: width, videoHeight: height } = video;
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(width, height, 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    if (!context || canvas.width === 0) throw new CaptureError('encode_failed', 'No camera frame to save');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new CaptureError('encode_failed', 'The browser could not make a JPEG');
    return blob.arrayBuffer();
  }
}
