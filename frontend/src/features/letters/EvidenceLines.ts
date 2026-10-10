import { BinAccess } from '../../domain/BinAccess';
import type { LetterEvidence } from '../../domain/SiteActions';
import type { LocaleFormatter } from '../../i18n/LocaleFormatter';
import type { LetterText } from './LetterText';

export interface EvidenceFact {
  readonly label: string;
  readonly value: string;
}

/** letter_draft.evidence as plain lines in the letter's language: every number with what it rests on. */
export class EvidenceLines {
  readonly #evidence: LetterEvidence;
  readonly #text: LetterText;
  readonly #format: LocaleFormatter;

  constructor(evidence: LetterEvidence, text: LetterText, format: LocaleFormatter) {
    this.#evidence = evidence;
    this.#text = text;
    this.#format = format;
  }

  facts(): readonly EvidenceFact[] {
    const e = this.#evidence;
    const label = (key: string) => this.#text.label(`evidence.${key}`);
    return [
      { label: label('reports'), value: this.#format.number(e.report_count) },
      { label: label('reporters'), value: e.reporters === null ? label('notCounted') : this.#format.number(e.reporters) },
      { label: label('verified'), value: this.#format.number(e.verified_count) },
      { label: label('first'), value: this.#format.dateTime(e.first_reported_at) },
      { label: label('last'), value: this.#format.dateTime(e.last_reported_at) },
    ];
  }

  /** Composition, size, hazards and nearby places, each with its count or distance. */
  insights(): readonly string[] {
    const insights = this.#evidence.insights;
    if (!insights) return [];
    const text = this.#text;
    const composition = insights.composition.map((part) =>
      text.label('evidence.material', { material: text.term(`areas.material.${part.material}`), pct: Math.round(part.share_pct), count: part.reports }),
    );
    const size = insights.size_class ? [text.label(`evidence.size.${insights.size_class}`)] : [];
    const hazards = insights.hazards.map((hazard) => text.label('evidence.hazard', { hazard: text.term(`letter.evidence.hazards.${hazard}`) }));
    const near = insights.near.map((place) => text.label(`evidence.near.${place.kind}`, { distance: this.#format.distance(place.distance_m) }));
    return [...composition, ...size, ...hazards, ...near];
  }

  /** The nearest known bin, or why there is none to name; null when bins were not measured. */
  bin(): string | null {
    const line = BinAccess.line(this.#evidence.nearest_bin, this.#evidence.no_bin_within_3km);
    if (!line) return null;
    const distance = line.key === 'nearest' ? this.#format.distance(line.metres) : '';
    return this.#text.term(`site.bin.${line.key}`, { distance });
  }
}
