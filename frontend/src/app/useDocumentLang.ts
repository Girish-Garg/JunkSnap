import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/** Keeps `<html lang>` on the current language; screen readers and the :lang(hi) font rule read it. */
export function useDocumentLang(): void {
  const { i18n } = useTranslation();
  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);
}
