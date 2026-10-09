import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LocaleFormatter } from './LocaleFormatter';

export function useFormatter(): LocaleFormatter {
  const { i18n } = useTranslation();
  return useMemo(() => new LocaleFormatter(i18n.language), [i18n.language]);
}
