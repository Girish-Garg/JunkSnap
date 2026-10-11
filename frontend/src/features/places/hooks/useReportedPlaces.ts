import { useEffect, useMemo, useState } from 'react';
import { useConfig } from '../../../app/useConfig';
import { useServices } from '../../../app/useServices';
import { AreaDirectory } from '../../../domain/AreaDirectory';
import type { AreaListing } from '../../../domain/AreaListing';
import type { AreaScores } from '../../../domain/AreaScores';
import { PILOT_DISTRICT } from '../../../domain/PilotAreas';
import { ReportedPlaces, type PlaceRows, type ReportedPlace } from '../../../domain/ReportedPlaces';
import type { LonLat } from '../../../domain/Site';
import type { AreaApi } from '../../../services/AreaApi';
import { usePilotSites } from '../../map/hooks/usePilotSites';
import { useMapContext } from '../../map/useMapContext';

// GET /areas/{kind} caps a page at 200 areas. The map's fill and the Areas tab ask for these same pages, so
// CachedAreaApi answers all three from one request each.
const LIMIT = 200;
const NO_ROWS: PlaceRows = { districts: [], seats: [] };

export interface PlaceRow {
  readonly place: ReportedPlace;
  /** Where the map goes for it: its sites; for the pilot city with none known yet, the city's bounds. Never empty. */
  readonly points: readonly LonLat[];
}

export interface ReportedPlacesState {
  /**
   * Never empty: the pilot city is listed before any count arrives, and when none does. A seat or another district
   * joins once the app holds a site of it, so a row never takes the map somewhere its sites are not.
   */
  readonly rows: readonly PlaceRow[];
  readonly loading: boolean;
  /** A list of counts failed, so a count or a place may be missing. */
  readonly failed: boolean;
}

interface Loaded extends PlaceRows {
  readonly failed: boolean;
}

type Listed = PromiseSettledResult<AreaListing>;

const rowsOf = (results: readonly Listed[]): readonly AreaScores[] =>
  results.flatMap((result) => (result.status === 'fulfilled' ? result.value.areas : []));

/** The pilot city's seats and the district rows of these districts; a list that fails leaves the others in place. */
async function loadRows(areas: AreaApi, districts: readonly string[]): Promise<Loaded> {
  const asked = [areas.list('assembly', PILOT_DISTRICT.id, LIMIT), ...districts.map((id) => areas.list('district', id, LIMIT))];
  const results = await Promise.allSettled(asked);
  const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failed) console.error('Could not load some counts for the places with reports', failed.reason);
  return { seats: rowsOf(results.slice(0, 1)), districts: rowsOf(results.slice(1)), failed: failed !== undefined };
}

/**
 * "Places with reports": the pilot city, its busiest seats and the districts around the map, with the counts of
 * the area list route (GET /areas/district and GET /areas/assembly) and, for each, where the map should go. That
 * comes from the sites the app holds: the map's own and one GET /sites over the pilot city. A seat whose sites lie
 * outside the city (a rural seat of the district) is counted in the city's row but gets no row of its own.
 */
export function useReportedPlaces(): ReportedPlacesState {
  const { areas } = useServices();
  const { limits, pilot: city } = useConfig();
  const { sites } = useMapContext();
  const { sites: pilot, failed: pilotFailed } = usePilotSites(true, null);
  const key = AreaDirectory.districts(PILOT_DISTRICT.id, sites).join('|');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    let current = true;
    void loadRows(areas, key.split('|')).then((next) => current && setLoaded(next));
    return () => {
      current = false;
    };
  }, [areas, key]);
  const rows = useMemo(() => {
    const known = [...(pilot ?? []), ...sites];
    const places = ReportedPlaces.of(loaded ?? NO_ROWS, PILOT_DISTRICT, limits);
    // A place none of whose sites the app holds is left out; the pilot city always has its own bounds.
    return places.map((place) => ({ place, points: ReportedPlaces.frame(place, known, city) })).filter((row) => row.points.length > 0);
  }, [loaded, pilot, sites, limits, city]);
  // Still loading until the counts and the pilot city's sites are both in (or have failed): the seats need both.
  // A new district set keeps the last list on screen until its own arrives.
  const loading = loaded === null || (pilot === null && !pilotFailed);
  return { rows, loading, failed: loaded?.failed ?? false };
}
