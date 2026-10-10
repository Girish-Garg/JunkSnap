import { useEffect, useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { SeatLabel } from '../../../domain/PlaceSearch';
import type { LabelPoints } from '../../../services/BoundaryCatalog';

const NONE: readonly SeatLabel[] = [];

function toSeats(points: LabelPoints): readonly SeatLabel[] {
  // A missing or odd file leaves search with the loaded sites alone.
  if (!Array.isArray(points.features)) return NONE;
  return points.features.map(({ properties, geometry }) => ({
    id: properties.id,
    name: properties.name,
    kind: properties.kind,
    point: [geometry.coordinates[0] ?? 0, geometry.coordinates[1] ?? 0],
  }));
}

/** Every seat the app ships boundaries for, loaded the first time someone types a search. */
export function useSeatLabels(enabled: boolean): readonly SeatLabel[] {
  const { boundaries } = useServices();
  const [seats, setSeats] = useState<readonly SeatLabel[]>(NONE);
  useEffect(() => {
    if (!enabled) return undefined;
    let current = true;
    boundaries.labels().then(
      (points) => current && setSeats(toSeats(points)),
      (error: unknown) => console.error('Could not load seat names for search', error),
    );
    return () => {
      current = false;
    };
  }, [boundaries, enabled]);
  return seats;
}
