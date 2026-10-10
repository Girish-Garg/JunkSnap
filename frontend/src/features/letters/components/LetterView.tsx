import { useTranslation } from 'react-i18next';
import type { LetterDraft } from '../../../domain/SiteActions';
import { LetterText } from '../LetterText';
import { LetterAddress } from './LetterAddress';
import { LetterCitations } from './LetterCitations';
import { LetterEvidence } from './LetterEvidence';

interface LetterViewProps {
  readonly draft: LetterDraft;
  /** The print copy carries no screen-only notes. */
  readonly forPrint?: boolean;
}

/** The letter as the resident will file it: addressed to offices, never to people. */
export function LetterView({ draft, forPrint = false }: LetterViewProps) {
  const { t } = useTranslation();
  const text = new LetterText(t, draft);
  return (
    <article className={forPrint ? 'letter letter--print' : 'letter'} lang={draft.language} aria-label={draft.subject} aria-hidden={forPrint || undefined}>
      <LetterAddress draft={draft} text={text} />
      <p className="letter__body">{draft.body}</p>
      {draft.evidence && <LetterEvidence evidence={draft.evidence} text={text} language={draft.language} />}
      <LetterCitations citations={draft.citations} text={text} />
      {draft.template_fallback && <p className="letter__note">{text.label('templateFallback')}</p>}
      <p className="letter__note">{text.label('residentFiles')}</p>
    </article>
  );
}
