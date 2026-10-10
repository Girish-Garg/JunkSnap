import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServices } from '../../../app/useServices';
import type { LetterBase } from '../../../domain/SiteActions';
import type { NativeBridge } from '../../../services/NativeBridge';
import { LetterText } from '../LetterText';

export type CopyState = 'idle' | 'copied' | 'failed';

function labelKey(state: CopyState, shares: boolean): string {
  if (state === 'copied') return 'letter.copied';
  return shares ? 'actions.share' : 'letter.copy';
}

/**
 * Copies the letter as plain text, ending with the shared page's link; inside the Android app it opens the share sheet instead and
 * copies only if that fails. Clipboard access can be refused, and then the resident copies by hand.
 */
export function useCopyLetter(draft: LetterBase, native: NativeBridge, link?: string) {
  const { t } = useTranslation();
  const { sharer } = useServices();
  const [state, setState] = useState<CopyState>('idle');
  const shares = native.canShareText();
  const copyText = (text: string) =>
    sharer.copy(text).then(
      () => setState('copied'),
      () => setState('failed'),
    );
  const copy = () => {
    const text = new LetterText(t, draft).plain(link);
    if (!shares) return void copyText(text);
    void native.shareText(text).catch(() => copyText(text));
  };
  return { state, copy, label: labelKey(state, shares) };
}
