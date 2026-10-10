import { raisedSignals, type CommunitySignals, type SiteCommunity } from '../../domain/Community';

export interface SignalChip {
  /** i18n key under notes.signals. */
  readonly key: string;
  readonly values?: Readonly<Record<string, number>>;
}

/** Turns site.community into the summary for the app language and chips for each raised signal. */
export class CommunityPresenter {
  readonly #community: SiteCommunity;

  constructor(community: SiteCommunity) {
    this.#community = community;
  }

  summary(language: string): string {
    return language.startsWith('hi') ? this.#community.summary_hi : this.#community.summary_en;
  }

  chips(): SignalChip[] {
    const signals = this.#community.signals;
    const duration = CommunityPresenter.#duration(signals);
    return [...(duration ? [duration] : []), ...raisedSignals(signals).map((flag) => ({ key: `notes.signals.${flag}` }))];
  }

  static #duration(signals: CommunitySignals): SignalChip | null {
    const days = signals.duration_days;
    if (days === null) return null;
    if (days >= 60) return { key: 'notes.signals.months', values: { count: Math.round(days / 30) } };
    if (days >= 14) return { key: 'notes.signals.weeks', values: { count: Math.round(days / 7) } };
    return { key: 'notes.signals.days', values: { count: days } };
  }
}
