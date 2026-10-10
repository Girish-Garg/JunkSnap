import { useTranslation } from 'react-i18next';
import { AppSettingsButton } from '../../../ui/AppSettingsButton';
import { Notice } from '../../../ui/Notice';
import { useInAppKey } from '../../../ui/useNativeBridge';
import type { MapNoticeView } from '../MapNotice';

interface MapStatusProps {
  readonly notice: MapNoticeView | null;
}

const LOCATION_DENIED = 'notice.locationDenied';

export function MapStatus({ notice }: MapStatusProps) {
  const { t } = useTranslation();
  const deniedKey = useInAppKey(LOCATION_DENIED, 'notice.locationDeniedApp');
  if (!notice) return null;
  const denied = notice.key === LOCATION_DENIED;
  return (
    <div className="map-status">
      <Notice icon={notice.icon} text={t(denied ? deniedKey : notice.key)} tone={notice.tone} />
      {denied && <AppSettingsButton />}
    </div>
  );
}
