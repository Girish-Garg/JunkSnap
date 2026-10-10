import type { AreaInsights, AreaScores } from '../../domain/AreaScores';
import type { LocaleFormatter } from '../../i18n/LocaleFormatter';
import type { Fact } from '../../ui/FactList';
import type { AreaPresenter, Translate } from './AreaPresenter';

export interface ShareView {
  readonly label: string;
  readonly pct: number;
  readonly text: string;
}

export interface CompositionView {
  readonly shares: readonly ShareView[];
  /** Why there are no shares, or the reports and models they come from. */
  readonly note: string;
}

/** Area insights, measured values only; a withheld value shows its reason instead. */
export class AreaInsightsPresenter {
  readonly #insights: AreaInsights | undefined;
  readonly #area: AreaPresenter;
  readonly #t: Translate;
  readonly #format: LocaleFormatter;

  constructor(scores: AreaScores, area: AreaPresenter, translate: Translate, format: LocaleFormatter) {
    this.#insights = scores.insights;
    this.#area = area;
    this.#t = translate;
    this.#format = format;
  }

  /** The worker's first zero-count row has no insights yet. */
  ready(): boolean {
    return this.#insights !== undefined;
  }

  composition(): CompositionView {
    const composition = this.#insights?.composition;
    if (!composition?.value) return { shares: [], note: this.#area.withheldNote(composition?.reason ?? 'no_data') };
    const shares = composition.value.map((share) => ({
      label: this.#t(`areas.material.${share.material}`),
      pct: share.share_pct,
      text: this.#percent(share.share_pct),
    }));
    return { shares, note: this.#t('areas.compositionFrom', { n: this.#format.number(composition.reports) }) };
  }

  facts(): readonly Fact[] {
    const insights = this.#insights;
    if (!insights) return [];
    const { hazardous_share_pct: hazards, near_school_or_water_count: near, repeat_spots: repeat } = insights;
    return [
      {
        label: this.#t('areas.insight.hazards'),
        value: hazards.value === null ? this.#area.withheldNote(hazards.reason) : this.#ofSites(hazards.hazardous_sites, hazards.sites, hazards.value),
      },
      {
        label: this.#t('areas.insight.near'),
        value: near.value === null ? this.#area.withheldNote(near.reason) : this.#ofSites(near.value, near.sites),
      },
      {
        label: this.#t('areas.insight.repeat'),
        value: repeat.value === null ? this.#area.withheldNote(repeat.reason) : this.#format.number(repeat.count),
      },
    ];
  }

  // The insights count only sites holding verified reports, so "0 of 0" next to "Sites: 1" says none is verified yet.
  #ofSites(part: number, whole: number, pct?: number): string {
    if (whole === 0) return this.#t('areas.noVerifiedSites');
    const text = this.#t('areas.ofSites', { part: this.#format.number(part), whole: this.#format.number(whole) });
    return pct === undefined ? text : `${this.#percent(pct)} · ${text}`;
  }

  #percent(value: number): string {
    return `${this.#format.number(value)}%`;
  }
}
