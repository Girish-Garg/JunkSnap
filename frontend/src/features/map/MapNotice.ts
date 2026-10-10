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
  /** A toast's i18n key; it shows before every other notice while it lasts. */
  readonly flash?: string | null;
}

export interface MapNoticeView {
  readonly icon: IconName;
  readonly key: string;
  readonly tone: 'info' | 'alert';
}

type Rule = readonly [(input: MapNoticeInput) => boolean, MapNoticeView];

// One banner at a time, in this order (frontend/DESIGN.md).
const RULES: readonly Rule[] = [
  [(s) => !s.online, { icon: 'offline', key: 'notice.offline', tone: 'alert' }],
  [(s) => s.failed, { icon: 'info', key: 'notice.loadFailed', tone: 'alert' }],
  [(s) => s.locationProblem === 'denied', { icon: 'locate', key: 'notice.locationDenied', tone: 'info' }],
  [(s) => s.locationProblem === 'unavailable', { icon: 'locate', key: 'notice.locationUnavailable', tone: 'info' }],
  [(s) => s.loadedCount > 0 && s.shownCount === 0, { icon: 'info', key: 'notice.filteredEmpty', tone: 'info' }],
  [(s) => s.clamped, { icon: 'search', key: 'notice.zoomIn', tone: 'info' }],
  [(s) => s.truncated === true, { icon: 'search', key: 'notice.capped', tone: 'info' }],
  [(s) => s.loaded && s.loadedCount === 0, { icon: 'info', key: 'notice.empty', tone: 'info' }],
];

export class MapNotice {
  static pick(input: MapNoticeInput): MapNoticeView | null {
    if (input.flash) return { icon: 'info', key: input.flash, tone: 'info' };
    return RULES.find(([applies]) => applies(input))?.[1] ?? null;
  }
}
