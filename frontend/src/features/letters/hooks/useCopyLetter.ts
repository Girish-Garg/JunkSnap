import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServices } from '../../../app/useServices';
import type { LetterBase } from '../../../domain/SiteActions';
import { LetterText } from '../LetterText';

export type CopyState = 'idle' | 'copied' | 'failed';

/**
 * Copies the letter as plain text, ending with the shared page's link (Share has its own button). Clipboard access can
 * be refused, and then the resident copies by hand.
 */
export function useCopyLetter(draft: LetterBase, link?: string) {
  const { t } = useTranslation();
  const { sharer } = useServices();
  const [state, setState] = useState<CopyState>('idle');
  const copy = () =>
    void sharer.copy(new LetterText(t, draft).plain(link)).then(
      () => setState('copied'),
      () => setState('failed'),
    );
  return { state, copy, label: state === 'copied' ? 'letter.copied' : 'letter.copy' };
}
