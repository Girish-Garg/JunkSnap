import type { PhotoView } from '../SitePresenter';
import { usePhotoReport } from '../hooks/usePhotoReport';
import { PhotoReportSheet } from './PhotoReportSheet';
import { SitePhotoStrip } from './SitePhotoStrip';

interface SitePhotoSectionProps {
  readonly siteId: string;
  readonly photos: readonly PhotoView[];
  /** A site still on the map takes photo reports; one off it shows its photos only. */
  readonly reportable: boolean;
  /** Reads the site again after a report went through. */
  readonly onChanged: () => void;
}

/** The photo strip and, while one is open, the sheet to report a photo (decision 20261011-0310-hem-photo-flags). */
export function SitePhotoSection({ siteId, photos, reportable, onChanged }: SitePhotoSectionProps) {
  const report = usePhotoReport();
  return (
    <>
      <SitePhotoStrip photos={photos} onReport={reportable ? report.start : undefined} />
      {report.photoId && (
        <PhotoReportSheet key={report.photoId} place={{ siteId, photoId: report.photoId }} onClose={report.close} onSent={onChanged} />
      )}
    </>
  );
}
