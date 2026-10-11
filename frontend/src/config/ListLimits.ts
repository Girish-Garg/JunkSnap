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
}

export const LIMIT_VARS: EnvVars<ListLimits> = {
  mailtoMaxLength: Vars.count('VITE_MAILTO_MAX_LENGTH', 1800, 100_000, 200),
  searchResults: Vars.count('VITE_SEARCH_RESULTS', 6, 50),
  listPageSize: Vars.count('VITE_LIST_PAGE_SIZE', 30, 500),
};

export const LIMIT_DEFAULTS: ListLimits = EnvReader.defaults(LIMIT_VARS);
