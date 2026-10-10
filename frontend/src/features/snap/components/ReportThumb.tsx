import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../../ui/Icon';

interface ReportThumbProps {
  /** The public blurred copy only, never the original. */
  readonly url: string | null;
  readonly size?: 'small' | 'large';
}

export function ReportThumb({ url, size = 'small' }: ReportThumbProps) {
  const { t } = useTranslation();
  const [broken, setBroken] = useState(false);
  if (url === null || broken) {
    return (
      <span className={`report-thumb report-thumb--${size} report-thumb--missing`} title={t('activity.noPhoto')}>
        <Icon name="photo" size={20} />
        <span className="visually-hidden">{t('activity.noPhoto')}</span>
      </span>
    );
  }
  return (
    <img
      className={`report-thumb report-thumb--${size}`}
      src={url}
      alt={t('activity.photoAlt')}
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );
}
