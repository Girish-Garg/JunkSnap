import { JunkSnapError } from './JunkSnapError';

/** insecure: the page is not on HTTPS, so the browser hides the camera and WebCrypto. */
export type CaptureProblem = 'camera_denied' | 'camera_unavailable' | 'insecure' | 'encode_failed';

export class CaptureError extends JunkSnapError {
  readonly problem: CaptureProblem;

  constructor(problem: CaptureProblem, message: string) {
    super(message);
    this.problem = problem;
  }
}
