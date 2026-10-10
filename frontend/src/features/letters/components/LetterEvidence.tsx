import type { LetterEvidence as Evidence } from '../../../domain/SiteActions';
import { LocaleFormatter } from '../../../i18n/LocaleFormatter';
import { EvidenceLines } from '../EvidenceLines';
import type { LetterText } from '../LetterText';
import { EvidencePhotos } from './EvidencePhotos';

interface LetterEvidenceProps {
  readonly evidence: Evidence;
  readonly text: LetterText;
  readonly language: string;
}

/** What the letter rests on: counts, dates, blurred photos, measured insights and the nearest bin. Prints with the letter. */
export function LetterEvidence({ evidence, text, language }: LetterEvidenceProps) {
  const lines = new EvidenceLines(evidence, text, new LocaleFormatter(language));
  const notes = [...lines.insights(), ...(lines.bin() ? [lines.bin() ?? ''] : [])];
  return (
    <section className="letter__evidence">
      <h3 className="letter__heading">{text.label('evidence.title')}</h3>
      <dl className="facts__list">
        {lines.facts().map((fact) => (
          <div key={fact.label} className="facts__row">
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      <EvidencePhotos urls={evidence.photo_urls} text={text} />
      {notes.length > 0 && (
        <ul className="letter__insights">
          {notes.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
