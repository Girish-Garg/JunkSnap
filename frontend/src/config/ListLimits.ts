import { EnvReader } from './EnvReader';
import type { EnvVars } from './EnvVar';
import { Vars } from './Vars';

/** How much the app shows or packs at once. */
export interface ListLimits {
  /** Mail apps and Android intents cut long mailto: links; past this the letter goes to the clipboard instead. */
  readonly mailtoMaxLength: number;
  /** Places the map search lists at most. */
  readonly searchResults: number;
  /** Rows the site list renders per page; "Show more" adds a page. */
  readonly listPageSize: number;
  /** Rows "Places with reports" lists at most, the pilot city's seats included. */
  readonly placesListed: number;
  /** Seats of the pilot city "Places with reports" lists under it at most; 0 lists none. */
  readonly placeSeats: number;
}

export const LIMIT_VARS: EnvVars<ListLimits> = {
  mailtoMaxLength: Vars.count('VITE_MAILTO_MAX_LENGTH', 1800, 100_000, 200),
  searchResults: Vars.count('VITE_SEARCH_RESULTS', 6, 50),
  listPageSize: Vars.count('VITE_LIST_PAGE_SIZE', 30, 500),
  placesListed: Vars.count('VITE_PLACES_LISTED', 6, 50),
  placeSeats: Vars.count('VITE_PLACE_SEATS', 3, 20, 0),
};

export const LIMIT_DEFAULTS: ListLimits = EnvReader.defaults(LIMIT_VARS);
