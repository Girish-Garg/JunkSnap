import type { SiteLocation } from './Site';

/** The one area name a compact row shows: the most local area known. Area names are data, never translated. */
export class AreaName {
  static of(location: SiteLocation): string {
    return location.ward?.name ?? location.assembly_seat?.name ?? location.town ?? location.district.name;
  }
}
