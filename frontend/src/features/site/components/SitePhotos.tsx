import { useTranslation } from 'react-i18next';
import { Icon } from '../../../ui/Icon';
import type { SiteGates } from '../../actions/hooks/useSiteGates';
import { useAddPhoto } from '../hooks/useAddPhoto';
import { usePhotoReport } from '../hooks/usePhotoReport';
import type { PhotoView } from '../SitePresenter';
import { AddPhotoButton } from './AddPhotoButton';
import { PhotoReportSheet } from './PhotoReportSheet';
import { SitePhotoStrip } from './SitePhotoStrip';

interface SitePhotosProps {
  readonly siteId: string;
  readonly photos: readonly PhotoView[];
  /** The site's add-photo and report-photo gates (useSiteGates). */
  readonly gates: Pick<SiteGates, 'addPhoto' | 'reportPhoto'>;
  /** A site still on the map takes photo reports (decision 20261011-0310-hem-photo-flags). */
  readonly reportable?: boolean;
  /** Reads the site again after a photo report went through. */
  readonly onChanged?: () => void;
}

/** The site's photo carousel, how many photos it has ("3 photos"), "Add a photo" for one more, and "Report this photo". */
export function SitePhotos({ siteId, photos, gates, reportable = false, onChanged }: SitePhotosProps) {
  const { t } = useTranslation();
  const addPhoto = useAddPhoto(siteId, gates.addPhoto);
  const report = usePhotoReport(gates.reportPhoto);
  const count = photos.length;
  return (
    <div className="site-photos">
      <SitePhotoStrip photos={photos} onReport={reportable ? report.start : undefined} />
      <div className="site-photos__bar">
        <span className="site-photos__count">
          <Icon name="photo" size={18} />
          {count > 0 ? t('site.photoCount', { count }) : t('site.noPhotos')}
        </span>
        <AddPhotoButton addPhoto={addPhoto} />
      </div>
      {report.photoId && (
        <PhotoReportSheet key={report.photoId} place={{ siteId, photoId: report.photoId }} onClose={report.close} onSent={() => onChanged?.()} />
      )}
    </div>
  );
}
