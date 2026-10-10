import { useServices } from '../../../app/useServices';
import type { LetterDraft } from '../../../domain/SiteActions';
import { useLetterRequest } from './useLetterRequest';

/** A site letter: language, then POST /sites/{id}/letters. */
export function useLetter(siteId: string) {
  const { snap } = useServices();
  return useLetterRequest<LetterDraft>((language) => snap.siteActions.letter(siteId, language));
}

export type LetterFlow = ReturnType<typeof useLetter>;
