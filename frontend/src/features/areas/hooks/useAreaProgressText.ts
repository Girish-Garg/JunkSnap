import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormatter } from '../../../i18n/useFormatter';
import { AreaProgressText } from '../AreaProgressText';

/** The counts and status lines for areas, in the UI language. */
export function useAreaProgressText(): AreaProgressText {
  const { t } = useTranslation();
  const format = useFormatter();
  return useMemo(() => new AreaProgressText((key, params) => t(key, params), format), [t, format]);
}
