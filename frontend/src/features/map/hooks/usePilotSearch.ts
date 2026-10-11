import { useLocation } from 'react-router';
import { NavItems } from '../../nav/NavItems';

/**
 * Whether the search field may name the pilot city: the Map tab is in front and the map's middle is in the city.
 * On Areas, Report, Activity or Account, or with the map elsewhere in India, the field says what it searches.
 */
export function usePilotSearch(offPilot: boolean): boolean {
  const { pathname } = useLocation();
  return !offPilot && NavItems.selected(pathname) === 'map';
}
