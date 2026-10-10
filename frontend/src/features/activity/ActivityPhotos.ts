import type { QueuedReport } from '../../domain/QueuedReport';
import type { ViewerPhoto } from '../../ui/ViewerPhoto';

/** The viewer's photos for Activity: public blurred copies only; reports still being checked have none yet. */
export class ActivityPhotos {
  readonly photos: readonly ViewerPhoto[];

  constructor(reports: readonly QueuedReport[], alt: string) {
    this.photos = reports.flatMap(({ data }) => {
      const url = data.status?.blurred_url;
      return url ? [{ url, alt, takenAt: data.draft.captured_at }] : [];
    });
  }

  /** Where a report's photo sits in the viewer, or 0 when it has none. */
  indexOf(report: QueuedReport): number {
    return Math.max(0, this.photos.findIndex((photo) => photo.url === report.data.status?.blurred_url));
  }
}
