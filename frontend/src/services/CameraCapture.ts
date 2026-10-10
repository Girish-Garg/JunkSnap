import { CaptureError } from '../domain/CaptureError';

// The rear camera at up to 1080p; PhotoEncoder caps the saved photo at 2048 px anyway.
const CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
};

/** The in-app viewfinder stream. Without it the app falls back to the phone camera (file input with capture). */
export class CameraCapture {
  readonly #media: MediaDevices | undefined;

  constructor(media: MediaDevices | undefined) {
    this.#media = media;
  }

  isSupported(): boolean {
    return typeof this.#media?.getUserMedia === 'function';
  }

  async open(): Promise<MediaStream> {
    if (!this.#media || !this.isSupported()) throw new CaptureError('insecure', 'No camera API on this page');
    try {
      return await this.#media.getUserMedia(CONSTRAINTS);
    } catch (error) {
      const denied = error instanceof DOMException && error.name === 'NotAllowedError';
      throw new CaptureError(denied ? 'camera_denied' : 'camera_unavailable', String(error));
    }
  }

  static close(stream: MediaStream): void {
    for (const track of stream.getTracks()) track.stop();
  }
}
