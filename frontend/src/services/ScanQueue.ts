import { QueuedScan, type QueuedScanData } from '../domain/QueuedScan';
import type { ScanDraft } from '../domain/ScanUpload';
import { UploadQueue } from './UploadQueue';

/** Scan recordings waiting to be sent, keyed by the video's SHA-256. */
export class ScanQueue extends UploadQueue<QueuedScan, QueuedScanData> {
  add(draft: ScanDraft, video: ArrayBuffer): Promise<QueuedScan> {
    return this.enqueue(QueuedScan.record(draft, video, this.ports.clock.now()));
  }

  protected revive(data: QueuedScanData): QueuedScan {
    return QueuedScan.fromData(data);
  }
}
