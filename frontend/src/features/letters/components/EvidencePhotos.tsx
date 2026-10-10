import { useTranslation } from 'react-i18next';
import { UlidTime } from '../../../domain/UlidTime';
import { PhotoViewer } from '../../../ui/PhotoViewer';
import { usePhotoViewer } from '../../../ui/usePhotoViewer';
import type { ViewerPhoto } from '../../../ui/ViewerPhoto';
import type { LetterText } from '../LetterText';

interface EvidencePhotosProps {
  /** Blurred public copies only. */
  readonly urls: readonly string[];
  readonly text: LetterText;
}

/** Thumbnails print with the letter; on screen each opens the full-screen viewer. */
export function EvidencePhotos({ urls, text }: EvidencePhotosProps) {
  const { t } = useTranslation();
  const viewer = usePhotoViewer();
  if (urls.length === 0) return null;
  const photos: readonly ViewerPhoto[] = urls.map((url, index) => {
    // The id's time is when the photo was reported (uploaded), not when it was taken.
    const reportedAt = UlidTime.fromPhotoUrl(url);
    const alt = text.label('evidence.photoAlt', { n: index + 1 });
    return { url, alt, date: reportedAt ? { kind: 'reported', at: reportedAt } : null };
  });
  return (
    <ul className="letter__photos">
      {photos.map((photo, index) => (
        <li key={photo.url}>
          <button type="button" className="photo-open" title={t('viewer.open')} onClick={() => viewer.open(photos, index)}>
            <img src={photo.url} alt={photo.alt} loading="lazy" draggable={false} />
          </button>
        </li>
      ))}
      <PhotoViewer viewer={viewer} />
    </ul>
  );
}
