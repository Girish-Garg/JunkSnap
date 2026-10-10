import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { LetterBase } from '../../../domain/SiteActions';
import { NativeBridge } from '../../../services/NativeBridge';
import { Button } from '../../../ui/Button';
import { useCopyLetter } from '../hooks/useCopyLetter';
import { Icon } from '../../../ui/Icon';

interface LetterActionsProps {
  readonly draft: LetterBase;
  readonly onReset: () => void;
  /** The site or area share link, added to the copied or shared text. */
  readonly link?: string;
}

/** Print (Save as PDF) and copy or, in the Android app, share the text; JunkSnap never sends the letter. */
export function LetterActions({ draft, onReset, link }: LetterActionsProps) {
  const { t } = useTranslation();
  const native = useMemo(() => new NativeBridge(window), []);
  const copy = useCopyLetter(draft, native, link);
  return (
    <div className="letter-actions">
      <Button onClick={() => native.print()}>
        <Icon name="print" size={20} />
        {t('letter.print')}
      </Button>
      <Button variant="text" onClick={copy.copy}>
        {t(copy.label)}
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
