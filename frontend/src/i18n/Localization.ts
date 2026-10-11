import i18next, { type i18n } from 'i18next';
import { SITE_RULE_DEFAULTS } from '../config/SiteRules';
import { CopyNumbers, type CopyValues } from './CopyNumbers';
import en from './en.json';
import hi from './hi.json';
import type { LanguagePreference } from './LanguagePreference';

export class Localization {
  readonly i18n: i18n;

  /** copy: the numbers the strings name (CopyNumbers.of the config's site rules). */
  constructor(preference: LanguagePreference, copy: CopyValues = CopyNumbers.of(SITE_RULE_DEFAULTS)) {
    this.i18n = i18next.createInstance();
    void this.i18n.init({
      resources: { en: { translation: en }, hi: { translation: hi } },
      lng: preference.load(),
      fallbackLng: 'en',
      initAsync: false,
      interpolation: { escapeValue: false, defaultVariables: copy },
    });
    this.i18n.on('languageChanged', (language) => preference.save(language));
  }
}
