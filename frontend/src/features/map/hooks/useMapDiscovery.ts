import { useEffect, useState } from 'react';
import { NearestSites } from '../../../domain/NearestSites';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import type { CameraRequest } from '../CameraRequest';
import type { MapView } from '../SiteMap';

export interface OpeningInput {
  readonly view: MapView | null;
  /** This view finished loading with sites in it. */
  readonly found: boolean;
  /** The app opened on a site's own link, which always wins over the opening view. */
  readonly deepLinked: boolean;
  /** The last camera move the app asked for (a search, a deep link, "Go to my location", the opening fit itself). */
  readonly camera: CameraRequest | null;
}

/**
 * True once the opening view should stay as it is: the person moved, searched, followed a link, or already sees
 * sites. A location fix alone never settles it. Kept as state, so the pilot city's sites are asked for only before.
 */
export function useOpeningSettled({ view, found, deepLinked, camera }: OpeningInput): boolean {
  const [settled, setSettled] = useState(false);
  const settles = Boolean(view?.byUser) || found || deepLinked || camera !== null;
  if (settles && !settled) setSettled(true);
  return settled || settles;
}

export interface FitInput {
  readonly settled: boolean;
  readonly view: MapView | null;
  /** This view finished loading with no site in it. */
  readonly empty: boolean;
  /** Every site of the pilot city, or null while it loads. */
  readonly pilot: readonly SiteFeature[] | null;
  readonly frame: (points: readonly LonLat[]) => void;
}

/**
 * The opening move: the map opens on the pilot city, and if that first view loads empty and nothing else has moved
 * the map, it fits the city's sites once (the fit is a camera request, which settles the opening view). Judges and
 * first-time visitors never open on a blank map and never get taken out of Jodhpur.
 */
export function useOpeningFit({ settled, view, empty, pilot, frame }: FitInput): void {
  useEffect(() => {
    if (settled || !view || !empty || !pilot || pilot.length === 0) return;
    frame(NearestSites.frame(view.bbox, pilot));
  }, [settled, view, empty, pilot, frame]);
}
