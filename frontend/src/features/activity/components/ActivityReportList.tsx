import { useTranslation } from 'react-i18next';
import type { QueuedReport } from '../../../domain/QueuedReport';
import { PhotoViewer } from '../../../ui/PhotoViewer';
import { usePhotoViewer } from '../../../ui/usePhotoViewer';
import { ActivityPhotos } from '../ActivityPhotos';
import { ActivityItem } from './ActivityItem';

/** This phone's photo reports; a blurred thumbnail opens the viewer on every blurred copy in the list. */
export function ActivityReportList({ reports }: { readonly reports: readonly QueuedReport[] }) {
  const { t } = useTranslation();
  const viewer = usePhotoViewer();
  const photos = new ActivityPhotos(reports, t('activity.photoAlt'));
  return (
    <ul className="report-list" aria-label={t('activity.photos')}>
      {reports.map((report) => (
        <ActivityItem key={report.id} report={report} onOpen={() => viewer.open(photos.photos, photos.indexOf(report))} />
      ))}
      <PhotoViewer viewer={viewer} />
    </ul>
  );
}
