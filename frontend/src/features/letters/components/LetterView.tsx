import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { LetterBase } from '../../../domain/SiteActions';
import { LetterText } from '../LetterText';
import { LetterAddress } from './LetterAddress';
import { LetterCitations } from './LetterCitations';

interface LetterViewProps {
  readonly draft: LetterBase;
  /** The print copy carries no screen-only notes. */
  readonly forPrint?: boolean;
  /** The site's or the area's evidence, labelled in the letter's language. */
  readonly evidence?: (text: LetterText) => ReactNode;
}

/** The letter as the resident will file it: addressed to offices, never to people. */
export function LetterView({ draft, forPrint = false, evidence }: LetterViewProps) {
  const { t } = useTranslation();
  const text = new LetterText(t, draft);
  return (
    <article className={forPrint ? 'letter letter--print' : 'letter'} lang={draft.language} aria-label={draft.subject} aria-hidden={forPrint || undefined}>
      <LetterAddress draft={draft} text={text} />
      <p className="letter__body">{draft.body}</p>
      {evidence?.(text)}
      <LetterCitations citations={draft.citations} text={text} />
      {draft.template_fallback && <p className="letter__note">{text.label('templateFallback')}</p>}
      <p className="letter__note">{text.label('residentFiles')}</p>
    </article>
  );
}
