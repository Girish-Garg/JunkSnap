import { useTranslation } from 'react-i18next';
import type { LetterBase } from '../../../domain/SiteActions';
import type { NativeBridge } from '../../../services/NativeBridge';
import { Button } from '../../../ui/Button';
import { useCopyLetter } from '../hooks/useCopyLetter';
import { useMailLetter } from '../hooks/useMailLetter';
import { useShareLetter } from '../hooks/useShareLetter';

interface LetterSendButtonsProps {
  readonly draft: LetterBase;
  readonly native: NativeBridge;
  readonly link?: string;
}

/** Ways for the resident to send the letter on: their own mail app, a share sheet, or the clipboard. */
export function LetterSendButtons({ draft, native, link }: LetterSendButtonsProps) {
  const { t } = useTranslation();
  const mail = useMailLetter(draft, link);
  const share = useShareLetter(draft, native, link);
  const copy = useCopyLetter(draft, link);
  return (
    <>
      {/* In the Android app the opener plugin hands target=_blank links to the mail app. */}
      <a className="button button--text" href={mail.url} target={native.inApp() ? '_blank' : undefined} rel="noreferrer" onClick={mail.onOpen}>
        {t('letter.email')}
      </a>
      {share && (
        <Button variant="text" onClick={share}>
          {t('actions.share')}
        </Button>
      )}
      <Button variant="text" onClick={copy.copy}>
        {t(copy.label)}
      </Button>
      {copy.state === 'failed' && (
        <p className="form__error" role="alert">
          {t('letter.copyFailed')}
        </p>
      )}
    </>
  );
}
