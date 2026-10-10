import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { useOnline } from './useOnline';

/** The line at the top of every sheet while the phone is offline; the map says it in its own toast. */
export function OfflineLine() {
  const { t } = useTranslation();
  const online = useOnline();
  if (online) return null;
  return (
    <p className="offline-line" role="status">
      <Icon name="offline" size={18} />
      {t('connection.offline')}
    </p>
  );
}
