import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServices } from '../../../app/useServices';
import type { LetterDraft } from '../../../domain/SiteActions';
import { LetterText } from '../LetterText';

export type CopyState = 'idle' | 'copied' | 'failed';

/** Copies the letter as plain text; clipboard access can be refused, and then the resident copies by hand. */
export function useCopyLetter(draft: LetterDraft) {
  const { t } = useTranslation();
  const { sharer } = useServices();
  const [state, setState] = useState<CopyState>('idle');
  const copy = () =>
    void sharer.copy(new LetterText(t, draft).plain()).then(
      () => setState('copied'),
      () => setState('failed'),
    );
  return { state, copy };
}
