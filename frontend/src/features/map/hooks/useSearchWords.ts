import { useTranslation } from 'react-i18next';
import { usePilotName } from './usePilotName';

export interface SearchWords {
  /** The field's accessible name. */
  readonly label: string;
  readonly placeholder: string;
}

/**
 * What the search field says. With the map on the pilot city it names the city; anywhere else it says what the
 * search finds: seats everywhere, and the wards and towns named by the sites on the map (PlaceSearch).
 */
export function useSearchWords(local: boolean): SearchWords {
  const { t } = useTranslation();
  const city = usePilotName();
  if (!local) return { label: t('search.label'), placeholder: t('search.placeholder') };
  return { label: t('search.labelCity', { city }), placeholder: t('search.placeholderCity', { city }) };
}
