import { AreaKey } from './AreaKey';
import type { AreaScores } from './AreaScores';
import type { PilotCity } from './PilotCity';
import type { LonLat, SiteFeature } from './Site';
import { SiteListing } from './SiteListing';

/** One row of "Places with reports": a district, or an assembly seat of the pilot city's district. */
export interface ReportedPlace {
  readonly area: AreaKey;
  /** Sites on the map there now (open and reopened), or null when no count could be loaded. */
  readonly count: number | null;
  /** The pilot city itself: always listed, and framed by the city's own bounds while none of its sites is known. */
  readonly pilot: boolean;
}

/** The scores rows the list is made from; a list that failed or has not arrived is left empty. */
export interface PlaceRows {
  /** GET /areas/district rows: the pilot city's district and the districts around the map. */
  readonly districts: readonly AreaScores[];
  /** GET /areas/assembly rows of the pilot city's district. */
  readonly seats: readonly AreaScores[];
}

/** The config's limits: rows listed at most, and how many of them may be seats of the pilot city. */
export interface PlaceLimits {
  readonly placesListed: number;
  readonly placeSeats: number;
}

const mostFirst = (a: ReportedPlace, b: ReportedPlace) => (b.count ?? 0) - (a.count ?? 0);
const total = (places: readonly ReportedPlace[]) => places.reduce((sum, place) => sum + (place.count ?? 0), 0);

/**
 * Where the reports are: the pilot city (always listed, so there is always a way back to it) with its busiest
 * seats right under it, and every other district that has sites on the map. Districts come most sites first, and
 * so do the seats under the city.
 */
export class ReportedPlaces {
  /** Sites of the area on the active map: open and reopened; cleared, removed and expired ones have left it. */
  static count(row: AreaScores): number {
    return row.counts.open_sites + row.counts.reopened_sites;
  }

  static of(rows: PlaceRows, pilot: AreaKey, limits: PlaceLimits): readonly ReportedPlace[] {
    const districts = rows.districts.map((row) => ReportedPlaces.#place(row, row.area.id === pilot.id));
    const seats = rows.seats.map((row) => ReportedPlaces.#place(row, false)).filter((place) => place.count !== null).sort(mostFirst);
    const own = districts.find((place) => place.pilot);
    // A district row still at zero (the worker's first row) or not loaded: its seats' rows count the same sites.
    const city: ReportedPlace = { area: own?.area ?? pilot, count: own?.count ?? (total(seats) || null), pilot: true };
    const others = districts.filter((place) => !place.pilot && place.count !== null);
    // The sort is stable, so the pilot city leads a tie.
    const ranked = [city, ...others].sort(mostFirst);
    const listed = ranked.flatMap((place) => (place === city ? [city, ...seats.slice(0, limits.placeSeats)] : [place])).slice(0, limits.placesListed);
    // A short list never drops the pilot city, however many sites other districts have.
    return listed.includes(city) ? listed : [city, ...listed.slice(0, limits.placesListed - 1)];
  }

  /**
   * Where the map goes for a place: its sites among those the app holds (each once). With none, the pilot city
   * takes its own bounds and any other place goes nowhere, so a row never leads to a map without that place's sites.
   */
  static frame(place: ReportedPlace, known: readonly SiteFeature[], city: PilotCity): readonly LonLat[] {
    const held = new Map<string, LonLat>();
    for (const site of known) {
      if (SiteListing.onMap(site.properties) && place.area.holds(site)) held.set(site.properties.site_id, site.geometry.coordinates);
    }
    if (held.size > 0) return [...held.values()];
    return place.pilot ? city.frame() : [];
  }

  // A count of zero is no count: the row is the worker's first one, or every site there has left the map.
  static #place(row: AreaScores, pilot: boolean): ReportedPlace {
    const area = new AreaKey(row.area.kind, row.area.id, row.area.name);
    return { area, count: ReportedPlaces.count(row) || null, pilot };
  }
}
