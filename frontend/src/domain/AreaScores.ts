// Mirrors contracts/schemas/ward_scores.schema.json (GET /areas/{kind}/{id}/scores); change the contract first.

export type AreaKind = 'ward' | 'assembly' | 'loksabha' | 'district';

/** null when the value is set; too_few_reports below min_verified_reports; no_data when an input is missing. */
export type WithheldReason = null | 'too_few_reports' | 'no_data';

export interface Score {
  readonly value: number | null;
  readonly reason: WithheldReason;
}

export type ScoreName = 'city' | 'citizen' | 'bin_access';

export interface AreaCounts {
  readonly verified_reports: number;
  readonly no_bin_reports: number;
  readonly sites: number;
  readonly open_sites: number;
  readonly cleaned_sites: number;
  readonly reopened_sites: number;
}

export type Diagnosis = 'infrastructure_gap' | 'behaviour' | 'city_response' | 'repeat_spot';

export type Material =
  | 'plastic'
  | 'organic'
  | 'construction_debris'
  | 'paper'
  | 'glass'
  | 'metal'
  | 'textile'
  | 'e_waste'
  | 'medical';

export interface MaterialShare {
  readonly material: Material;
  readonly share_pct: number;
}

interface Withholdable<T> {
  readonly value: T | null;
  readonly reason: WithheldReason;
}

export interface AreaInsights {
  readonly composition: Withholdable<readonly MaterialShare[]> & { readonly reports: number };
  readonly hazardous_share_pct: Withholdable<number> & { readonly hazardous_sites: number; readonly sites: number };
  readonly repeat_spots: Withholdable<readonly string[]> & { readonly count: number };
  readonly near_school_or_water_count: Withholdable<number> & { readonly sites: number };
}

export interface AreaScores {
  readonly area: { readonly kind: AreaKind; readonly id: string; readonly name: string };
  readonly counts: AreaCounts;
  readonly min_verified_reports: number;
  readonly scores: Readonly<Record<ScoreName, Score>>;
  readonly diagnosis: readonly Diagnosis[];
  readonly formula_version: string;
  readonly pilot: boolean;
  readonly data_window: { readonly from: string; readonly to: string };
  readonly computed_at: string;
  /** Optional in v1.1; the worker's first zero-count row has none. */
  readonly insights?: AreaInsights;
}
