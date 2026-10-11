import type { LocationProblem } from '../../domain/LocationError';
import type { IconName } from '../../ui/Icon';

export interface MapNoticeInput {
  readonly online: boolean;
  readonly failed: boolean;
  readonly locationProblem: LocationProblem | null;
  readonly loaded: boolean;
  readonly loadedCount: number;
  readonly shownCount: number;
  /** The view is wider than the map loads at once, so only its middle has sites. */
  readonly clamped: boolean;
  /** A GET /sites query hit its 500 cap, so older sites are missing. */
  readonly truncated?: boolean;
  /**
   * For an empty view: whether sites lie just off screen; null while that is still being looked up, and
   * left out when nobody looks (then the view is simply empty).
   */
  readonly nearby?: boolean | null;
  /** A toast's i18n key; it shows before every other notice while it lasts. */
  readonly flash?: string | null;
}

export interface MapNoticeView {
  readonly icon: IconName;
  readonly key: string;
  /** warn: a state to wait out (offline), in the amber of the offline line; alert: something failed. */
  readonly tone: 'info' | 'warn' | 'alert';
  /** A button beside the text: move to the nearest sites off screen. */
  readonly action?: 'nearest';
}

type Rule = readonly [(input: MapNoticeInput) => boolean, MapNoticeView];

// One banner at a time, in this order (frontend/DESIGN.md).
const RULES: readonly Rule[] = [
  [(s) => !s.online, { icon: 'offline', key: 'notice.offline', tone: 'warn' }],
  [(s) => s.failed, { icon: 'info', key: 'notice.loadFailed', tone: 'alert' }],
  [(s) => s.locationProblem === 'denied', { icon: 'locate', key: 'notice.locationDenied', tone: 'info' }],
  [(s) => s.locationProblem === 'unavailable', { icon: 'locate', key: 'notice.locationUnavailable', tone: 'info' }],
  [(s) => s.loadedCount > 0 && s.shownCount === 0, { icon: 'info', key: 'notice.filteredEmpty', tone: 'info' }],
  [(s) => s.clamped, { icon: 'search', key: 'notice.zoomIn', tone: 'info' }],
  [(s) => s.truncated === true, { icon: 'search', key: 'notice.capped', tone: 'info' }],
  [(s) => s.loaded && s.loadedCount === 0 && s.nearby === true, { icon: 'info', key: 'notice.offScreen', tone: 'info', action: 'nearest' }],
  // Never "no reports" while the search around the view is still on its way.
  [(s) => s.loaded && s.loadedCount === 0 && s.nearby !== null, { icon: 'info', key: 'notice.empty', tone: 'info' }],
];

export class MapNotice {
  static pick(input: MapNoticeInput): MapNoticeView | null {
    if (input.flash) return { icon: 'info', key: input.flash, tone: 'info' };
    return RULES.find(([applies]) => applies(input))?.[1] ?? null;
  }
}
