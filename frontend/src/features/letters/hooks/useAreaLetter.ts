import { useMemo, useState } from 'react';
import { useServices } from '../../../app/useServices';
import { AreaIssueTally } from '../../../domain/AreaIssueTally';
import { AreaKey } from '../../../domain/AreaKey';
import type { AreaIssue, AreaLetterDraft } from '../../../domain/AreaLetter';
import type { AreaKind, AreaScores } from '../../../domain/AreaScores';
import { useMapContext } from '../../map/useMapContext';
import { useLetterRequest } from './useLetterRequest';

/** The area's verified reports per issue, from its scores and its sites loaded on the map; null while the scores load. */
function useAreaTally(kind: AreaKind, id: string, scores: AreaScores | null): AreaIssueTally | null {
  const { sites } = useMapContext();
  return useMemo(() => {
    if (!scores) return null;
    const area = new AreaKey(kind, id, scores.area.name);
    const held = sites.filter((site) => area.holds(site)).map((site) => site.properties);
    return new AreaIssueTally(scores.counts, scores.min_verified_reports, held);
  }, [kind, id, scores, sites]);
}

/** An area letter: the issue (one report type or all), the language, then POST /areas/{kind}/{id}/letters. */
export function useAreaLetter(kind: AreaKind, id: string, scores: AreaScores | null) {
  const { snap } = useServices();
  const tally = useAreaTally(kind, id, scores);
  const [chosen, setChosen] = useState<AreaIssue | null>(null);
  // Until the resident picks one, the issue with the most verified reports; every issue while the counts load.
  const issue = chosen ?? tally?.pick() ?? 'all';
  const request = useLetterRequest<AreaLetterDraft>((language) => snap.areaLetters.letter({ kind, id }, issue, language), 'area');
  const setIssue = (next: AreaIssue) => {
    setChosen(next);
    request.clear();
  };
  return { ...request, issue, setIssue, tally };
}

export type AreaLetterFlow = ReturnType<typeof useAreaLetter>;
