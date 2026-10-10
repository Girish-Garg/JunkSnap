import type { GpsState } from './hooks/useGpsFix';

// Sites merge within 40 m, so a fix worse than 30 m gets a warning.
const WEAK_GPS_M = 30;

export interface GpsViewModel {
  readonly key: string;
  readonly metres: number | null;
  readonly tone: 'plain' | 'good' | 'alert';
}

export class GpsView {
  static of({ fix, problem }: GpsState): GpsViewModel {
    if (fix) {
      const metres = Math.round(fix.accuracy_m);
      const weak = metres > WEAK_GPS_M;
      return { key: weak ? 'snap.gps.weak' : 'snap.gps.fix', metres, tone: weak ? 'alert' : 'good' };
    }
    if (problem) return { key: `snap.gps.${problem}`, metres: null, tone: 'alert' };
    return { key: 'snap.gps.searching', metres: null, tone: 'plain' };
  }
}
