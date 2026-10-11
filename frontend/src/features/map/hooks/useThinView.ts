import { useMemo, useState } from 'react';
import { useConfig } from '../../../app/useConfig';
import type { SiteFeature } from '../../../domain/Site';
import { ThinView, type ThinState } from '../../../domain/ThinView';
import type { CameraRequest } from '../CameraRequest';
import type { MapView } from '../SiteMap';
import type { SitesLoad } from './useSites';

interface ThinSources {
  readonly view: MapView | null;
  readonly loaded: SitesLoad;
  /** The view is too wide to load whole. */
  readonly partial: boolean;
  /** The nearest sites just off an empty view, or null while that search is on its way. */
  readonly nearest: readonly SiteFeature[] | null;
  /** The pilot city's sites, if they were already loaded. */
  readonly pilot: readonly SiteFeature[] | null;
  /** The last camera move the app asked for (the opening fit, Zoom out, a search). */
  readonly camera: CameraRequest | null;
  /** The opening view is settled (useOpeningSettled): no opening fit is still to come. */
  readonly opening: boolean;
}

// A camera move is on its way until the map reports its next view.
function useMoving(camera: CameraRequest | null, view: MapView | null): boolean {
  const [asked, setAsked] = useState({ camera, view });
  if (asked.camera !== camera) setAsked({ camera, view });
  const current = asked.camera === camera ? asked : { camera, view };
  return camera !== null && current.view === view;
}

// An empty first view is about to be fitted to the pilot city's sites (useOpeningFit): wait for that move.
function fitComing({ opening, loaded, pilot }: ThinSources): boolean {
  return !opening && loaded.sites.length === 0 && (pilot === null || pilot.length > 0);
}

// Keeps the last answer while the next one is on its way (a pan, a load, a move), so the card never blinks.
function useHeld(next: ThinState | null | undefined): ThinState | null {
  const [held, setHeld] = useState<ThinState | null>(null);
  const changed = next !== undefined && !ThinView.same(next, held);
  if (changed) setHeld(next);
  return changed ? next : held;
}

/**
 * Whether the view holds few or no sites, from what the page already loaded: it never asks the api itself.
 * A failed load or a view too wide to load says nothing; a load or a move on its way keeps the last answer.
 */
export function useThinView(sources: ThinSources): ThinState | null {
  const { view, loaded, partial, nearest, pilot } = sources;
  const { map } = useConfig();
  const waiting = useMoving(sources.camera, view) || fitComing(sources) || !loaded.loaded || loaded.pending;
  const next = useMemo(() => {
    if (loaded.failed || partial) return null;
    const input = { view: view?.bbox ?? null, settled: !waiting, sites: loaded.sites, known: nearest === null ? null : [...nearest, ...(pilot ?? [])] };
    return ThinView.ready(input) ? ThinView.of(input, map) : undefined;
  }, [view, waiting, loaded.failed, loaded.sites, partial, nearest, pilot, map]);
  return useHeld(next);
}
