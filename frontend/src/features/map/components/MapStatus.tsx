import { useTranslation } from 'react-i18next';
import { AppSettingsButton } from '../../../ui/AppSettingsButton';
import { Notice } from '../../../ui/Notice';
import { useInAppKey } from '../../../ui/useNativeBridge';
import type { MapNoticeView } from '../MapNotice';

interface MapStatusProps {
  readonly notice: MapNoticeView | null;
  /** Moves to the nearest sites off screen; the notice offers it when there are some. */
  readonly onNearest?: () => void;
}

const LOCATION_DENIED = 'notice.locationDenied';

export function MapStatus({ notice, onNearest }: MapStatusProps) {
  const { t } = useTranslation();
  const deniedKey = useInAppKey(LOCATION_DENIED, 'notice.locationDeniedApp');
  if (!notice) return null;
  const denied = notice.key === LOCATION_DENIED;
  const nearest = notice.action === 'nearest' && onNearest;
  return (
    <div className="map-status">
      <Notice icon={notice.icon} text={t(denied ? deniedKey : notice.key)} tone={notice.tone} />
      {denied && <AppSettingsButton />}
      {nearest && (
        <button type="button" className="pill map-status__action" onClick={onNearest}>
          {t('notice.showNearest')}
        </button>
      )}
    </div>
  );
}
