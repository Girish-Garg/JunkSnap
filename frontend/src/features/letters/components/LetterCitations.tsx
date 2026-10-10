import type { LetterCitation } from '../../../domain/SiteActions';
import type { LetterText } from '../LetterText';

interface LetterCitationsProps {
  readonly citations: readonly LetterCitation[];
  readonly text: LetterText;
}

/** Each rule quoted word for word, with its document, clause and the official PDF's SHA-256. */
export function LetterCitations({ citations, text }: LetterCitationsProps) {
  return (
    <section className="letter__citations">
      <h3 className="letter__heading">{text.label('citations')}</h3>
      <ol className="letter__citation-list">
        {citations.map((citation) => (
          <li key={citation.rule_id} className="letter__citation">
            <p className="letter__source">
              {citation.document}, {text.label('clause')} {citation.clause}
            </p>
            <blockquote className="letter__quote">{citation.quote}</blockquote>
            <p className="letter__hash">
              {text.label('hash')}: <code>{citation.source_sha256}</code>
            </p>
          </li>
        ))}
      </ol>
      <p className="letter__verified">{text.verified()}</p>
    </section>
  );
}
