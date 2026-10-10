import { useTranslation } from 'react-i18next';
import type { LetterDraft } from '../../../domain/SiteActions';
import { LetterText } from '../LetterText';
import { LetterCitations } from './LetterCitations';

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
      <dl className="letter__address">
        <div>
          <dt>{text.label('to')}</dt>
          <dd>{text.to()}</dd>
        </div>
        {draft.cc.length > 0 && (
          <div>
            <dt>{text.label('ccLabel')}</dt>
            {draft.cc.map((cc) => (
              <dd key={cc.seat.id}>{text.cc(cc)}</dd>
            ))}
          </div>
        )}
        <div>
          <dt>{text.label('subject')}</dt>
          <dd className="letter__subject">{draft.subject}</dd>
        </div>
      </dl>
      <p className="letter__body">{draft.body}</p>
      <LetterCitations citations={draft.citations} text={text} />
      {draft.template_fallback && <p className="letter__note">{text.label('templateFallback')}</p>}
      <p className="letter__note">{text.label('residentFiles')}</p>
    </article>
  );
}
