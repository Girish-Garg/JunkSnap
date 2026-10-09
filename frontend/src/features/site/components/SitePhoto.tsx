import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../../ui/Icon';

interface SitePhotoProps {
  /** Blurred public copy only, never an original. */
  readonly url: string | null;
  readonly alt: string;
}

export function SitePhoto({ url, alt }: SitePhotoProps) {
  const { t } = useTranslation();
  const [broken, setBroken] = useState(false);
  if (url === null || broken) {
    return (
      <li className="photo-strip__item photo-strip__item--missing">
        <Icon name="photo" />
        {t('site.photoMissing')}
      </li>
    );
  }
  return (
    <li className="photo-strip__item">
      <img src={url} alt={alt} loading="lazy" onError={() => setBroken(true)} />
    </li>
  );
}
