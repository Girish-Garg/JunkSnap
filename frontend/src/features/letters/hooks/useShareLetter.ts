import { useTranslation } from 'react-i18next';
import { useServices } from '../../../app/useServices';
import type { LetterBase } from '../../../domain/SiteActions';
import type { NativeBridge } from '../../../services/NativeBridge';
import { LetterText } from '../LetterText';

/** Shares the letter's text: the Android app's share sheet, else the browser's; null where neither exists. */
export function useShareLetter(draft: LetterBase, native: NativeBridge, link?: string): (() => void) | null {
  const { t } = useTranslation();
  const { sharer, errors, notifier } = useServices();
  if (!native.canShareText() && !sharer.canShare()) return null;
  return () => {
    const text = new LetterText(t, draft).plain(link);
    const shared = native.canShareText() ? native.shareText(text) : sharer.shareText(draft.subject, text);
    // Closing the share sheet is not a failure; anything else is logged and said.
    shared.catch((error: unknown) => {
      if (errors.report('share', error).category !== 'aborted') notifier.push({ key: 'letter.shareFailed', tone: 'alert' });
    });
  };
}
