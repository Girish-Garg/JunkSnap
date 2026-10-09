import { useTranslation } from 'react-i18next';
import type { Language } from '../i18n/LanguagePreference';

// Short labels fit inside the search field; the full name is the accessible name.
const OPTIONS: readonly { readonly language: Language; readonly short: string; readonly name: string }[] = [
  { language: 'en', short: 'EN', name: 'English' },
  { language: 'hi', short: 'हि', name: 'हिन्दी' },
];

export function LanguageToggle() {
  const { t, i18n } = useTranslation();
  return (
    <div className="lang-toggle" role="group" aria-label={t('language.label')}>
      {OPTIONS.map(({ language, short, name }) => (
        <button
          key={language}
          type="button"
          lang={language}
          className="lang-toggle__option"
          aria-label={name}
          aria-pressed={i18n.language === language}
          onClick={() => void i18n.changeLanguage(language)}
        >
          {short}
        </button>
      ))}
    </div>
  );
}
