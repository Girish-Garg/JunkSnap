import { CaptureError } from '../domain/CaptureError';

export type CameraUse = 'photo' | 'video';

// Photos: the rear camera at up to 1080p (PhotoEncoder caps the JPEG at 2048 px).
// Video: at most 1280 by 720 at 30 fps, the scan video limit.
const CONSTRAINTS: Readonly<Record<CameraUse, MediaStreamConstraints>> = {
  photo: { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
  video: {
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280, max: 1280 }, height: { ideal: 720, max: 720 }, frameRate: { ideal: 30, max: 30 } },
  },
};

/** The in-app viewfinder stream; there is no gallery or phone-camera fallback. */
export class CameraCapture {
  readonly #media: MediaDevices | undefined;

  constructor(media: MediaDevices | undefined) {
    this.#media = media;
  }

  isSupported(): boolean {
    return typeof this.#media?.getUserMedia === 'function';
  }

  async open(use: CameraUse = 'photo'): Promise<MediaStream> {
    if (!this.#media || !this.isSupported()) throw new CaptureError('insecure', 'No camera API on this page');
    try {
      return await this.#media.getUserMedia(CONSTRAINTS[use]);
    } catch (error) {
      const denied = error instanceof DOMException && error.name === 'NotAllowedError';
      throw new CaptureError(denied ? 'camera_denied' : 'camera_unavailable', String(error));
    }
  }

  static close(stream: MediaStream): void {
    for (const track of stream.getTracks()) track.stop();
  }
}
