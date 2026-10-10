import { useTranslation } from 'react-i18next';
import { LANGUAGES, type Language } from '../../../i18n/LanguagePreference';
import { Segmented } from '../../../ui/Segmented';

// Each language by its own name, so either reader finds theirs.
const NAMES: Readonly<Record<Language, string>> = { en: 'English', hi: 'हिन्दी' };

/** Account → Settings → Language: the same choice as the EN / हि toggle, always reachable, even in list mode. */
export function LanguageSetting() {
  const { t, i18n } = useTranslation();
  const current = LANGUAGES.find((language) => language === i18n.language) ?? 'en';
  const options = LANGUAGES.map((value) => ({ value, label: NAMES[value] }));
  return (
    <>
      <p className="settings__label">{t('settings.language')}</p>
      <Segmented<Language> label={t('settings.language')} options={options} value={current} onChange={(next) => void i18n.changeLanguage(next)} />
    </>
  );
}
