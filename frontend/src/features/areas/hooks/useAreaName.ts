import { useEffect, useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { AreaKind } from '../../../domain/AreaScores';
import { pilotArea } from '../../../domain/PilotAreas';

interface Found {
  readonly key: string;
  readonly name: string | null;
}

/**
 * An area's name without a scores row: from the pilot city's list, else from the map's area markers (assembly
 * seats in Rajasthan, Lok Sabha seats elsewhere). null while looking or when the area is not in either.
 */
export function useAreaName(kind: AreaKind, id: string): string | null {
  const { boundaries } = useServices();
  const pilot = pilotArea(kind, id)?.name ?? null;
  const key = `${kind}/${id}`;
  const [found, setFound] = useState<Found | null>(null);
  useEffect(() => {
    if (pilot !== null) return undefined;
    let current = true;
    boundaries.labels().then(
      (points) => {
        // A missing or odd file names nothing, as in search (useSeatLabels).
        const features = Array.isArray(points.features) ? points.features : [];
        const point = features.find(({ properties }) => properties.id === id && properties.kind === kind);
        if (current) setFound({ key, name: point?.properties.name ?? null });
      },
      (error: unknown) => console.error(`Could not look up the name of ${key}`, error),
    );
    return () => {
      current = false;
    };
  }, [boundaries, pilot, kind, id, key]);
  return pilot ?? (found?.key === key ? found.name : null);
}
