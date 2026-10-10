import type { AreaProgress } from '../../domain/AreaProgress';
import type { LocaleFormatter } from '../../i18n/LocaleFormatter';
import type { Fact } from '../../ui/FactList';
import type { Translate } from './AreaPresenter';

// The count rows of an area page, in its order (AreaPresenter.counts).
const COUNT_KEYS = ['verified_reports', 'no_bin_reports', 'sites', 'open_sites', 'cleaned_sites', 'reopened_sites'] as const;

/** The two lines a list row or the map card shows under an area's name. */
export interface ProgressLines {
  /** Always shown, zeros included: "Sites: 0 · verified reports: 0". */
  readonly counts: string;
  /** "No reports yet", "Not enough reports yet (n of 10 verified)", "Score withheld for now", or the shown score with its count. */
  readonly status: string;
}

/** Words for an area's progress; counts are always shown, and a score only once the api shows one. */
export class AreaProgressText {
  readonly #t: Translate;
  readonly #format: LocaleFormatter;

  constructor(translate: Translate, format: LocaleFormatter) {
    this.#t = translate;
    this.#format = format;
  }

  lines(progress: AreaProgress): ProgressLines {
    const verified = this.#format.number(progress.verified);
    const counts = this.#t('areas.rowCounts', { sites: this.#format.number(progress.sites), verified });
    return { counts, status: this.#status(progress, verified) };
  }

  #status(progress: AreaProgress, verified: string): string {
    if (progress.stage === 'none') return this.#t('areas.noReports');
    if (progress.stage === 'withheld') return this.#t('areas.scoreWithheld');
    if (progress.score === null) return this.#t('areas.notEnough', { n: verified, min: this.#format.number(progress.min) });
    return this.#t('areas.scoreLine', { n: this.#format.number(progress.score), reports: verified });
  }

  /** An area page's count rows for an area with no reports: every count 0, as the api would seed them. */
  zeroCounts(): readonly Fact[] {
    return COUNT_KEYS.map((key) => ({ label: this.#t(`areas.count.${key}`), value: this.#format.number(0) }));
  }
}
