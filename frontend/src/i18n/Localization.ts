import i18next, { type i18n } from 'i18next';
import en from './en.json';
import hi from './hi.json';
import type { LanguagePreference } from './LanguagePreference';

export class Localization {
  readonly i18n: i18n;

  constructor(preference: LanguagePreference) {
    this.i18n = i18next.createInstance();
    void this.i18n.init({
      resources: { en: { translation: en }, hi: { translation: hi } },
      lng: preference.load(),
      fallbackLng: 'en',
      initAsync: false,
      interpolation: { escapeValue: false },
    });
    this.i18n.on('languageChanged', (language) => preference.save(language));
  }
}
