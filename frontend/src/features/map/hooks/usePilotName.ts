import { useTranslation } from 'react-i18next';
import { DEFAULT_CITY } from '../../../domain/AreaListing';

/**
 * The pilot city's name in the language on screen, from the pilot data (DEFAULT_CITY) and the names the ranking
 * already shows, so copy that names the city ("Search {{city}}", "See {{city}}'s reports") holds no literal.
 */
export function usePilotName(): string {
  const { t } = useTranslation();
  return t(`ranking.city.${DEFAULT_CITY.key}`);
}
