import { useEffect, useState } from 'react';
import { useServices } from '../../../app/useServices';
import { ApiError } from '../../../domain/ApiError';
import type { AreaKind, AreaScores } from '../../../domain/AreaScores';

/** missing: the area has no sites (404 area_not_found); failed: any other error. */
export interface AreaScoresState {
  readonly scores: AreaScores | null;
  readonly missing: boolean;
  readonly failed: boolean;
}

interface AreaScoresResult extends AreaScoresState {
  readonly key: string;
}

const LOADING: AreaScoresState = { scores: null, missing: false, failed: false };

export function useAreaScores(kind: AreaKind, areaId: string): AreaScoresState {
  const { areas } = useServices();
  const [result, setResult] = useState<AreaScoresResult | null>(null);
  const key = `${kind}/${areaId}`;
  useEffect(() => {
    let current = true;
    areas.scores(kind, areaId).then(
      (scores) => {
        if (current) setResult({ key, scores, missing: false, failed: false });
      },
      (error: unknown) => {
        const missing = error instanceof ApiError && error.code === 'area_not_found';
        if (!missing) console.error(`Could not load scores for ${key}`, error);
        if (current) setResult({ key, scores: null, missing, failed: !missing });
      },
    );
    return () => {
      current = false;
    };
  }, [areas, kind, areaId, key]);
  return result?.key === key ? result : LOADING;
}
