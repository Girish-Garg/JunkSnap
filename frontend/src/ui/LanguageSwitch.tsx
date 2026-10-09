import { useTranslation } from 'react-i18next';
import type { Language } from '../i18n/LanguagePreference';

// Names stay in their own script so readers can find theirs.
const OPTIONS: readonly { readonly language: Language; readonly name: string }[] = [
  { language: 'en', name: 'English' },
  { language: 'hi', name: 'हिन्दी' },
];

export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  return (
    <div className="language-switch" role="group" aria-label={t('language.label')}>
      {OPTIONS.map(({ language, name }) => (
        <button
          key={language}
          type="button"
          lang={language}
          className="language-switch__option"
          aria-pressed={i18n.language === language}
          onClick={() => void i18n.changeLanguage(language)}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
