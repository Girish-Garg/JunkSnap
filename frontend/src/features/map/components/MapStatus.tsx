import { useTranslation } from 'react-i18next';
import { AppSettingsButton } from '../../../ui/AppSettingsButton';
import { Notice } from '../../../ui/Notice';
import { useInAppKey } from '../../../ui/useNativeBridge';
import type { StatusActions } from '../hooks/useStatusActions';
import type { MapNoticeView } from '../MapNotice';
import { MapStatusActions } from './MapStatusActions';
import { PilotChip } from './PilotChip';

interface MapStatusProps {
  readonly notice: MapNoticeView | null;
  /** What the notice's buttons do; a button shows only when its notice offers it and its action is here. */
  readonly actions?: StatusActions;
}

const LOCATION_DENIED = 'notice.locationDenied';

/** The toast line with its buttons, and the way back to the pilot city's reports, which needs no notice to show. */
export function MapStatus({ notice, actions = {} }: MapStatusProps) {
  const { t } = useTranslation();
  const deniedKey = useInAppKey(LOCATION_DENIED, 'notice.locationDeniedApp');
  const chip = actions.pilot ? <PilotChip onView={actions.pilot} /> : null;
  if (!notice) return chip && <div className="map-status">{chip}</div>;
  const denied = notice.key === LOCATION_DENIED;
  return (
    <div className="map-status">
      <Notice icon={notice.icon} text={t(denied ? deniedKey : notice.key)} tone={notice.tone} busy={notice.busy} />
      {denied && <AppSettingsButton />}
      {notice.action && <MapStatusActions action={notice.action} actions={actions} />}
      {chip}
    </div>
  );
}
