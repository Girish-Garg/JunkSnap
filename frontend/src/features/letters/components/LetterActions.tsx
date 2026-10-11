import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { LetterBase } from '../../../domain/SiteActions';
import { NativeBridge } from '../../../services/NativeBridge';
import { Button } from '../../../ui/Button';
import type { LetterScope } from '../hooks/useLetterRequest';
import { Icon } from '../../../ui/Icon';
import { FilingSteps } from './FilingSteps';
import { LetterSendButtons } from './LetterSendButtons';

interface LetterActionsProps {
  readonly draft: LetterBase;
  readonly onReset: () => void;
  /** The site or area share link, added to the copied or shared text. */
  readonly link?: string;
  readonly scope?: LetterScope;
}

/** Print (Save as PDF), email, share or copy the text, and how to file it; JunkSnap never sends the letter. */
export function LetterActions({ draft, onReset, link, scope = 'site' }: LetterActionsProps) {
  const { t } = useTranslation();
  const native = useMemo(() => new NativeBridge(window), []);
  return (
    <div className="letter-actions">
      <Button onClick={() => native.print()}>
        <Icon name="print" size={20} />
        {t('letter.print')}
      </Button>
      <LetterSendButtons draft={draft} native={native} link={link} />
      {draft.filing_url && (
        <a className="button button--text" href={draft.filing_url} target="_blank" rel="noreferrer">
          {t('letter.openPortal')}
        </a>
      )}
      <Button variant="text" onClick={onReset}>
        {t('letter.another')}
      </Button>
      <FilingSteps scope={scope} copies={draft.cc.length > 0} />
    </div>
  );
}
