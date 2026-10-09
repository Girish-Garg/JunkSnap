import { useTranslation } from 'react-i18next';
import { Notice } from '../../../ui/Notice';
import type { MapNoticeView } from '../MapNotice';

interface MapStatusProps {
  readonly notice: MapNoticeView | null;
}

export function MapStatus({ notice }: MapStatusProps) {
  const { t } = useTranslation();
  if (!notice) return null;
  return (
    <div className="map-status">
      <Notice icon={notice.icon} text={t(notice.key)} tone={notice.tone} />
    </div>
  );
}
