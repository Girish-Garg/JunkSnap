import { useTranslation } from 'react-i18next';
import { useConfig } from '../../../app/useConfig';
import { useServices } from '../../../app/useServices';
import type { LetterBase } from '../../../domain/SiteActions';
import { LetterMailto, NO_KNOWN_ADDRESSES } from '../LetterMailto';
import { LetterText } from '../LetterText';

/**
 * "Send by email": a mailto: link with the subject and the letter, opened in the resident's own mail app. A letter too
 * long for the link is copied when the link is tapped, before the mail app opens, and the short body says to paste it.
 */
export function useMailLetter(draft: LetterBase, link?: string) {
  const { t } = useTranslation();
  const { sharer, notifier } = useServices();
  const { mailtoMaxLength } = useConfig().limits;
  const text = new LetterText(t, draft);
  const letter = text.plain(link);
  const mail = new LetterMailto(NO_KNOWN_ADDRESSES, mailtoMaxLength).compose(draft.subject, letter, text.short(link));
  const onOpen = () => {
    if (!mail.long) return;
    sharer.copy(letter).then(
      () => notifier.push({ key: 'letter.mailCopied' }),
      () => notifier.push({ key: 'letter.copyFailed', tone: 'alert' }),
    );
  };
  return { url: mail.url, onOpen };
}
