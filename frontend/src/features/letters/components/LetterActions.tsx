import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServices } from '../../../app/useServices';
import type { LetterDraft } from '../../../domain/SiteActions';
import { Button } from '../../../ui/Button';
import { LetterText } from '../LetterText';

interface LetterActionsProps {
  readonly draft: LetterDraft;
  readonly onReset: () => void;
}

/** Print (the browser's Save as PDF) or copy the text; JunkSnap never sends the letter. */
export function LetterActions({ draft, onReset }: LetterActionsProps) {
  const { t } = useTranslation();
  const { sharer } = useServices();
  const [copied, setCopied] = useState(false);
  const copy = () => void sharer.copy(new LetterText(t, draft).plain()).then(() => setCopied(true));
  return (
    <div className="letter-actions">
      <Button onClick={() => window.print()}>{t('letter.print')}</Button>
      <Button variant="text" onClick={copy}>
        {t(copied ? 'letter.copied' : 'letter.copy')}
      </Button>
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
