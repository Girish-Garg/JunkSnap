import type { AreaScores, Diagnosis, ScoreName, WithheldReason } from '../../domain/AreaScores';
import type { LocaleFormatter } from '../../i18n/LocaleFormatter';
import type { Fact } from '../../ui/FactList';

export type Translate = (key: string, params?: Readonly<Record<string, string>>) => string;

export interface ScoreView {
  readonly name: ScoreName;
  readonly label: string;
  readonly hint: string;
  /** Null when withheld; the note then says why. */
  readonly value: string | null;
  readonly note: string;
}

export interface DiagnosisView {
  readonly code: Diagnosis;
  readonly title: string;
  readonly text: string;
}

const SCORE_NAMES: readonly ScoreName[] = ['city', 'citizen', 'bin_access'];

/** How an area's scores read on screen. Shows only what the api measured; area names are data and stay untranslated. */
export class AreaPresenter {
  readonly #scores: AreaScores;
  readonly #t: Translate;
  readonly #format: LocaleFormatter;

  constructor(scores: AreaScores, translate: Translate, format: LocaleFormatter) {
    this.#scores = scores;
    this.#t = translate;
    this.#format = format;
  }

  kind(): string {
    return this.#t(`areas.kind.${this.#scores.area.kind}`);
  }

  /** "n verified reports" next to every score, or why the value is withheld. */
  withheldNote(reason: WithheldReason): string {
    const n = this.#format.number(this.#scores.counts.verified_reports);
    if (reason === 'too_few_reports') {
      return this.#t('areas.notEnough', { n, min: this.#format.number(this.#scores.min_verified_reports) });
    }
    if (reason === 'no_data') return this.#t('areas.noData', { n });
    return this.#t('areas.basedOn', { n });
  }

  scores(): readonly ScoreView[] {
    return SCORE_NAMES.map((name) => {
      const score = this.#scores.scores[name];
      return {
        name,
        label: this.#t(`areas.score.${name}`),
        hint: this.#t(`areas.scoreHint.${name}`),
        value: score.value === null ? null : this.#format.number(score.value),
        note: this.withheldNote(score.value === null ? score.reason : null),
      };
    });
  }

  counts(): readonly Fact[] {
    const counts = this.#scores.counts;
    const row = (key: string, value: number): Fact => ({ label: this.#t(`areas.count.${key}`), value: this.#format.number(value) });
    return [
      row('verified_reports', counts.verified_reports),
      row('no_bin_reports', counts.no_bin_reports),
      row('sites', counts.sites),
      row('open_sites', counts.open_sites),
      row('cleaned_sites', counts.cleaned_sites),
      row('reopened_sites', counts.reopened_sites),
    ];
  }

  diagnosis(): readonly DiagnosisView[] {
    return this.#scores.diagnosis.map((code) => ({
      code,
      title: this.#t(`areas.diagnosis.${code}.title`),
      text: this.#t(`areas.diagnosis.${code}.text`),
    }));
  }

  footnote(): string {
    const { data_window: window, computed_at: computedAt, formula_version: version } = this.#scores;
    return this.#t('areas.footnote', {
      from: this.#format.dateTime(window.from),
      to: this.#format.dateTime(window.to),
      computed: this.#format.dateTime(computedAt),
      version,
    });
  }
}
