import type { CameraCapture } from '../services/CameraCapture';
import type { ScanCapture } from '../services/ScanCapture';
import type { GpsWatcher } from '../services/GpsWatcher';
import type { ImageEncoder } from '../services/PhotoEncoder';
import type { PhotoHasher } from '../services/PhotoHasher';
import type { ReportQueue } from '../services/ReportQueue';
import type { ReportTracker } from '../services/ReportTracker';
import type { ScanQueue } from '../services/ScanQueue';
import type { ScanTracker } from '../services/ScanTracker';
import type { VideoRecorder } from '../services/VideoRecorder';

/** Everything the Snap, Scan and Activity screens use. */
export interface SnapServices {
  readonly queue: ReportQueue;
  readonly tracker: ReportTracker;
  readonly scans: ScanQueue;
  readonly scanTracker: ScanTracker;
  readonly recorder: VideoRecorder;
  readonly scanCapture: ScanCapture;
  readonly camera: CameraCapture;
  readonly encoder: ImageEncoder;
  readonly hasher: PhotoHasher;
  readonly gps: GpsWatcher;
}
