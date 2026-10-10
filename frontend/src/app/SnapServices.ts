import type { ActivityRemover } from '../services/ActivityRemover';
import type { AreaLetterService } from '../services/AreaLetterService';
import type { CameraCapture } from '../services/CameraCapture';
import type { CompassHeading } from '../services/CompassHeading';
import type { ScanCapture } from '../services/ScanCapture';
import type { GpsWatcher } from '../services/GpsWatcher';
import type { NoBinReporter } from '../services/NoBinReporter';
import type { ImageEncoder } from '../services/PhotoEncoder';
import type { PhotoHasher } from '../services/PhotoHasher';
import type { ReportQueue } from '../services/ReportQueue';
import type { ReportTracker } from '../services/ReportTracker';
import type { ScanQueue } from '../services/ScanQueue';
import type { ScanTracker } from '../services/ScanTracker';
import type { SiteActionService } from '../services/SiteActionService';
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
  readonly siteActions: SiteActionService;
  readonly areaLetters: AreaLetterService;
  readonly noBin: NoBinReporter;
  /** Deletes Activity rows, withdrawing reports from unverified sites first (decision 20261010-1700). */
  readonly remover: ActivityRemover;
  /** The phone's heading for the long-range direction line; absent where there is no window (tests). */
  readonly compass?: CompassHeading;
}
