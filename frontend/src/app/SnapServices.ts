import type { CameraCapture } from '../services/CameraCapture';
import type { GpsWatcher } from '../services/GpsWatcher';
import type { ImageEncoder } from '../services/PhotoEncoder';
import type { PhotoHasher } from '../services/PhotoHasher';
import type { ReportQueue } from '../services/ReportQueue';
import type { ReportTracker } from '../services/ReportTracker';

/** Everything the Snap and Activity screens use. */
export interface SnapServices {
  readonly queue: ReportQueue;
  readonly tracker: ReportTracker;
  readonly camera: CameraCapture;
  readonly encoder: ImageEncoder;
  readonly hasher: PhotoHasher;
  readonly gps: GpsWatcher;
}
