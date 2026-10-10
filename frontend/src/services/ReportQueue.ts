import { QueuedReport, type QueuedReportData } from '../domain/QueuedReport';
import type { ReportDraft } from '../domain/ReportUpload';
import { UploadQueue } from './UploadQueue';

/** Snap photos waiting to be sent, keyed by the photo's SHA-256. */
export class ReportQueue extends UploadQueue<QueuedReport, QueuedReportData> {
  add(draft: ReportDraft, photo: ArrayBuffer): Promise<QueuedReport> {
    return this.enqueue(QueuedReport.capture(draft, photo, this.ports.clock.now()));
  }

  protected revive(data: QueuedReportData): QueuedReport {
    return QueuedReport.fromData(data);
  }
}
