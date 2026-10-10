import type { AreaLetterEvidence, AreaLetterSite } from '../../domain/AreaLetter';
import type { LocaleFormatter } from '../../i18n/LocaleFormatter';
import type { EvidenceFact } from './EvidenceLines';
import { InsightLines } from './InsightLines';
import type { LetterText } from './LetterText';

/** An area letter's evidence as lines in the letter's language: every number with what it rests on. */
export class AreaEvidenceLines {
  readonly #evidence: AreaLetterEvidence;
  readonly #text: LetterText;
  readonly #format: LocaleFormatter;

  constructor(evidence: AreaLetterEvidence, text: LetterText, format: LocaleFormatter) {
    this.#evidence = evidence;
    this.#text = text;
    this.#format = format;
  }

  facts(): readonly EvidenceFact[] {
    const e = this.#evidence;
    const label = (key: string) => this.#text.label(`evidence.${key}`);
    return [
      { label: label('reports'), value: this.#format.number(e.reports) },
      { label: label('reporters'), value: e.reporters === null ? label('notCounted') : this.#format.number(e.reporters) },
      { label: label('verified'), value: this.#format.number(e.verified_reports) },
      { label: this.#text.term('areas.count.sites'), value: this.#format.number(e.sites) },
      { label: label('first'), value: this.#format.dateTime(e.first_reported_at) },
      { label: label('last'), value: this.#format.dateTime(e.last_reported_at) },
    ];
  }

  /** Measured scores only (the api leaves withheld ones out), each with the reports it rests on. */
  scores(): readonly string[] {
    return this.#evidence.scores.map((score) =>
      this.#text.label('areaEvidence.score', { name: this.#text.term(`areas.score.${score.name}`), value: score.value, n: score.verified_reports }),
    );
  }

  site(site: AreaLetterSite): string {
    const type = this.#text.term(`reportType.${site.report_type}`);
    const context = this.#text.term(`context.${site.context}`);
    const status = this.#text.term(`status.${site.status}`);
    return this.#text.label('areaEvidence.site', { type, context, status, reports: site.report_count, verified: site.verified_count });
  }

  siteDates(site: AreaLetterSite): string {
    return this.#text.label('areaEvidence.siteDates', { first: this.#format.dateTime(site.first_reported_at), last: this.#format.dateTime(site.last_reported_at) });
  }

  siteInsights(site: AreaLetterSite): readonly string[] {
    return InsightLines.of(site.insights, this.#text, this.#format);
  }

  bin(): string | null {
    const bins = this.#evidence.bin_access;
    return bins ? this.#text.label('areaEvidence.bins', { n: bins.sites_without_bin_within_3km, m: bins.sites_measured }) : null;
  }
}
