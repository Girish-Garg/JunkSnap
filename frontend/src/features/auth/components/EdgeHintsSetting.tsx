import { useTranslation } from 'react-i18next';
import { useEdgeHintsSetting } from '../../snap/hooks/useEdgeHintsSetting';
import { SwitchRow } from '../../../ui/SwitchRow';

/** Account → Settings → On-device hints: live boxes in the camera, only on devices that passed the probe. */
export function EdgeHintsSetting() {
  const { t } = useTranslation();
  const setting = useEdgeHintsSetting();
  if (!setting.supported) return null;
  return (
    <>
      <SwitchRow label={t('settings.edgeHints')} checked={setting.on} onToggle={() => setting.set(!setting.on)} />
      <p className="form__note">{t('settings.edgeHintsNote')}</p>
    </>
  );
}
