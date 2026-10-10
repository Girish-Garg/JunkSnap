import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../app/useTheme';
import { THEMES, type Theme } from '../../../services/ThemePreference';
import { Segmented } from '../../../ui/Segmented';
import { EdgeHintsSetting } from './EdgeHintsSetting';

/** Account → Settings → Appearance: System (default), Light or Dark. */
export function AppearanceSetting() {
  const { t } = useTranslation();
  const { theme, set } = useTheme();
  const options = THEMES.map((value) => ({ value, label: t(`settings.theme.${value}`) }));
  return (
    <section className="settings" aria-labelledby="settings-title">
      <h3 id="settings-title" className="section-label">
        {t('settings.title')}
      </h3>
      <p className="settings__label">{t('settings.appearance')}</p>
      <Segmented<Theme> label={t('settings.appearance')} options={options} value={theme} onChange={set} />
      <EdgeHintsSetting />
    </section>
  );
}
