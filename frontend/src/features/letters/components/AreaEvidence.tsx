import type { AreaLetterEvidence } from '../../../domain/AreaLetter';
import { LocaleFormatter } from '../../../i18n/LocaleFormatter';
import { AreaEvidenceLines } from '../AreaEvidenceLines';
import type { LetterText } from '../LetterText';
import { WorstSite } from './WorstSite';

interface AreaEvidenceProps {
  readonly evidence: AreaLetterEvidence;
  readonly text: LetterText;
  readonly language: string;
}

/** The issue's counts in the area, measured scores, bin access and the worst sites. Prints with the letter. */
export function AreaEvidence({ evidence, text, language }: AreaEvidenceProps) {
  const lines = new AreaEvidenceLines(evidence, text, new LocaleFormatter(language));
  const bin = lines.bin();
  const notes = [...lines.scores(), ...(bin ? [bin] : [])];
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
      {notes.length > 0 && (
        <ul className="letter__insights">
          {notes.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <h4 className="letter__source">{text.label('areaEvidence.sitesTitle')}</h4>
      {evidence.worst_sites.map((site) => (
        <WorstSite key={site.site_id} site={site} lines={lines} text={text} />
      ))}
    </section>
  );
}
