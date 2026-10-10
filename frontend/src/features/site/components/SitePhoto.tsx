import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../../ui/Icon';
import { PhotoCover } from '../../../ui/PhotoCover';

interface SitePhotoProps {
  /** Blurred public copy only, never an original. */
  readonly url: string | null;
  readonly alt: string;
  /** Opens the full-screen viewer; without it the photo is not a button (e.g. the preview card). */
  readonly onOpen?: () => void;
  /** Several people reported it: behind a tap-to-view cover first. */
  readonly warned?: boolean;
}

export function SitePhoto({ url, alt, onOpen, warned = false }: SitePhotoProps) {
  const { t } = useTranslation();
  const [broken, setBroken] = useState(false);
  if (url === null || broken) {
    return (
      <li className="photo-strip__item photo-strip__item--missing" title={t('site.photoMissing')}>
        <Icon name="photo" size={20} />
        <span className="visually-hidden">{t('site.photoMissing')}</span>
      </li>
    );
  }
  const image = <img src={url} alt={alt} loading="lazy" draggable={false} onError={() => setBroken(true)} />;
  return (
    <li className="photo-strip__item">
      <PhotoCover warned={warned}>
        {onOpen ? (
          <button type="button" className="photo-open" title={t('viewer.open')} onClick={onOpen}>
            {image}
          </button>
        ) : (
          image
        )}
      </PhotoCover>
    </li>
  );
}
