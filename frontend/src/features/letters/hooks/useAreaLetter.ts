import { useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { AreaIssue, AreaLetterDraft } from '../../../domain/AreaLetter';
import type { AreaKind } from '../../../domain/AreaScores';
import { useLetterRequest } from './useLetterRequest';

/** An area letter: the issue (one report type or all), the language, then POST /areas/{kind}/{id}/letters. */
export function useAreaLetter(kind: AreaKind, id: string) {
  const { snap } = useServices();
  const [issue, setIssue] = useState<AreaIssue>('waste_dump');
  const request = useLetterRequest<AreaLetterDraft>((language) => snap.areaLetters.letter({ kind, id }, issue, language), 'area');
  return { ...request, issue, setIssue };
}

export type AreaLetterFlow = ReturnType<typeof useAreaLetter>;
