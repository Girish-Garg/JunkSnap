import type { LocationProblem } from '../../domain/LocationError';
import type { IconName } from '../../ui/Icon';

export interface MapNoticeInput {
  readonly online: boolean;
  readonly failed: boolean;
  readonly locationProblem: LocationProblem | null;
  readonly loaded: boolean;
  readonly loadedCount: number;
  readonly shownCount: number;
  readonly clamped: boolean;
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
  [(s) => s.loaded && s.loadedCount === 0, { icon: 'info', key: 'notice.empty', tone: 'info' }],
];

export class MapNotice {
  static pick(input: MapNoticeInput): MapNoticeView | null {
    return RULES.find(([applies]) => applies(input))?.[1] ?? null;
  }
}
