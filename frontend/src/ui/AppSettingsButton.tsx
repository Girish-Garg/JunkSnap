import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { useNativeBridge } from './useNativeBridge';

/** "Open app settings" inside the Android app, where a blocked permission is allowed again; nothing in a browser. */
export function AppSettingsButton() {
  const { t } = useTranslation();
  const native = useNativeBridge();
  if (!native.canOpenAppSettings()) return null;
  return (
    <Button variant="text" onClick={() => native.openAppSettings()}>
      {t('snap.openSettings')}
    </Button>
  );
}
