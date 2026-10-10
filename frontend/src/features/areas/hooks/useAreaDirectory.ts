import { useCallback, useEffect, useMemo, useState } from 'react';
import { useServices } from '../../../app/useServices';
import { AreaDirectory, type AreaEntry } from '../../../domain/AreaDirectory';
import { AREA_KINDS } from '../../../domain/AreaKey';
import { DEFAULT_CITY, type AreaListing } from '../../../domain/AreaListing';
import type { AreaKind } from '../../../domain/AreaScores';
import { PILOT_AREAS } from '../../../domain/PilotAreas';
import type { AreaApi } from '../../../services/AreaApi';
import { useMapContext } from '../../map/useMapContext';

export type { AreaEntry } from '../../../domain/AreaDirectory';

// GET /areas/{kind} caps a page at 200 areas; a district has far fewer wards and seats.
const LIMIT = 200;

/**
 * What failed: `counts`, a list of the pilot city (its areas say "Couldn't load counts"); `areas`, only a list of
 * another district around the map (its reported areas may be missing); null when every list loaded.
 */
export type PartialLoad = 'counts' | 'areas' | null;

export interface AreaDirectoryState {
  /** null while loading. */
  readonly entries: readonly AreaEntry[] | null;
  readonly partial: PartialLoad;
  /** Asks again for the lists that failed (CachedAreaApi forgets a failed request at once). */
  readonly retry: () => void;
}

interface Loaded {
  readonly entries: readonly AreaEntry[];
  readonly partial: PartialLoad;
}

interface Outcome {
  readonly kind: AreaKind;
  readonly within: string;
  readonly listing: AreaListing | null;
  readonly error: unknown;
}

/** Every list for these districts; a list that fails leaves the others in place and marks its pilot kind unloaded. */
export async function loadDirectory(areas: AreaApi, districts: readonly string[]): Promise<Loaded> {
  const asked = districts.flatMap((within) => AREA_KINDS.map((kind) => ({ kind, within })));
  const outcomes = await Promise.all(
    asked.map(({ kind, within }) =>
      areas.list(kind, within, LIMIT).then(
        (listing): Outcome => ({ kind, within, listing, error: null }),
        (error: unknown): Outcome => ({ kind, within, listing: null, error }),
      ),
    ),
  );
  const listings = outcomes.flatMap((outcome) => (outcome.listing ? [outcome.listing] : []));
  const failed = outcomes.filter((outcome) => outcome.listing === null);
  if (failed.length > 0) console.error('Could not load some areas', failed[0]?.error);
  const unloaded = new Set(failed.filter((outcome) => outcome.within === DEFAULT_CITY.id).map((outcome) => outcome.kind));
  const partial: PartialLoad = unloaded.size > 0 ? 'counts' : failed.length > 0 ? 'areas' : null;
  return { entries: AreaDirectory.of(listings, PILOT_AREAS, unloaded), partial };
}

/**
 * Every seat and the district of the pilot city, reported or not, plus every reported ward, seat and district
 * of the districts around the map (where the person is looking, or standing once located), with the counts
 * and scores of the area list route; not only the sites on screen.
 */
export function useAreaDirectory(query: string): AreaDirectoryState {
  const { areas } = useServices();
  const { sites } = useMapContext();
  const key = AreaDirectory.districts(DEFAULT_CITY.id, sites).join('|');
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    let current = true;
    void loadDirectory(areas, key.split('|')).then((next) => current && setLoaded(next));
    return () => {
      current = false;
    };
  }, [areas, key, attempt]);
  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  // A new district set keeps the last list on screen until its own arrives.
  const entries = useMemo(() => loaded && AreaDirectory.match(loaded.entries, query), [loaded, query]);
  return { entries, partial: loaded?.partial ?? null, retry };
}
