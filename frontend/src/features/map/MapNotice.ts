import type { LocationProblem } from '../../domain/LocationError';
import type { IconName } from '../../ui/Icon';

/**
 * How far the basemap has got (useBasemapStatus). idle: no map (list mode) or not started; loading: under 600 ms,
 * so a fast network sees nothing; waiting: "Loading the map…"; slow: past 8 s; loaded; failed: Retry.
 */
export type BasemapPhase = 'idle' | 'loading' | 'waiting' | 'slow' | 'loaded' | 'failed';

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
  /** How far the basemap has got; left out where there is no map (the list). */
  readonly basemap?: BasemapPhase;
}

/** nearest: show the nearest sites off screen; retryMap: load the map again; mapless: what works without it. */
export type NoticeAction = 'nearest' | 'retryMap' | 'mapless';

export interface MapNoticeView {
  readonly icon: IconName;
  readonly key: string;
  /** warn: a state to wait out (offline), in the amber of the offline line; alert: something failed. */
  readonly tone: 'info' | 'warn' | 'alert';
  /** Buttons beside the text, or below it when they do not fit. */
  readonly action?: NoticeAction;
  /** A spinner in place of the icon: something is still on its way. */
  readonly busy?: boolean;
}

type Rule = readonly [(input: MapNoticeInput) => boolean, MapNoticeView];

// One banner at a time, in this order (frontend/DESIGN.md).
const RULES: readonly Rule[] = [
  [(s) => !s.online, { icon: 'offline', key: 'notice.offline', tone: 'warn' }],
  // The basemap: Retry first, so the map's Try again is never hidden behind "Could not load sites"; then
  // nothing for 600 ms, "Loading the map…", and the slow line from 8 s.
  [(s) => s.basemap === 'failed', { icon: 'info', key: 'notice.mapFailed', tone: 'alert', action: 'retryMap' }],
  [(s) => s.failed, { icon: 'info', key: 'notice.loadFailed', tone: 'alert' }],
  [(s) => s.basemap === 'slow', { icon: 'info', key: 'notice.mapSlow', tone: 'warn', action: 'mapless', busy: true }],
  [(s) => s.basemap === 'waiting', { icon: 'info', key: 'notice.mapLoading', tone: 'info', busy: true }],
  [(s) => s.locationProblem === 'denied', { icon: 'locate', key: 'notice.locationDenied', tone: 'info' }],
  [(s) => s.locationProblem === 'unavailable', { icon: 'locate', key: 'notice.locationUnavailable', tone: 'info' }],
  [(s) => s.loadedCount > 0 && s.shownCount === 0, { icon: 'info', key: 'notice.filteredEmpty', tone: 'info' }],
  [(s) => s.clamped, { icon: 'search', key: 'notice.zoomIn', tone: 'info' }],
  [(s) => s.truncated === true, { icon: 'search', key: 'notice.capped', tone: 'info' }],
  [(s) => s.loaded && s.loadedCount === 0 && s.nearby === true, { icon: 'info', key: 'notice.offScreen', tone: 'info', action: 'nearest' }],
  // Never "no reports" while the search around the view is still on its way.
  [(s) => s.loaded && s.loadedCount === 0 && s.nearby !== null, { icon: 'info', key: 'notice.empty', tone: 'info' }],
];

// What the few-reports card already says, with its Zoom out (ThinMapCard).
const SAID_BY_CARD: ReadonlySet<string> = new Set(['notice.empty', 'notice.offScreen']);

export class MapNotice {
  static pick(input: MapNoticeInput): MapNoticeView | null {
    if (input.flash) return { icon: 'info', key: input.flash, tone: 'info' };
    return RULES.find(([applies]) => applies(input))?.[1] ?? null;
  }

  /** The toast beside the few-reports card: never a second "no reports here". */
  static besideCard(notice: MapNoticeView | null): MapNoticeView | null {
    return notice && SAID_BY_CARD.has(notice.key) ? null : notice;
  }
}
