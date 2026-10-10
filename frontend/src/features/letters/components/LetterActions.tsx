import { useTranslation } from 'react-i18next';
import type { LetterDraft } from '../../../domain/SiteActions';
import { Button } from '../../../ui/Button';
import { useCopyLetter } from '../hooks/useCopyLetter';

interface LetterActionsProps {
  readonly draft: LetterDraft;
  readonly onReset: () => void;
}

/** Print (the browser's Save as PDF) or copy the text; JunkSnap never sends the letter. */
export function LetterActions({ draft, onReset }: LetterActionsProps) {
  const { t } = useTranslation();
  const copy = useCopyLetter(draft);
  return (
    <div className="letter-actions">
      <Button onClick={() => window.print()}>{t('letter.print')}</Button>
      <Button variant="text" onClick={copy.copy}>
        {t(copy.state === 'copied' ? 'letter.copied' : 'letter.copy')}
      </Button>
      {copy.state === 'failed' && (
        <p className="form__error" role="alert">
          {t('letter.copyFailed')}
        </p>
      )}
      {draft.filing_url && (
        <a className="button button--text" href={draft.filing_url} target="_blank" rel="noreferrer">
          {t('letter.openPortal')}
        </a>
      )}
      <Button variant="text" onClick={onReset}>
        {t('letter.another')}
      </Button>
    </div>
  );
}
