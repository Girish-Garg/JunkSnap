import type { AreaScores, Score, ScoreName, WithheldReason } from '../src/domain/AreaScores';

const WITHHELD: Score = { value: null, reason: 'too_few_reports' };

interface RowOptions {
  readonly id?: string;
  readonly name?: string;
  readonly reports?: number;
  readonly scores?: Partial<Record<ScoreName, number | WithheldReason>>;
}

function score(value: number | WithheldReason | undefined): Score {
  if (typeof value === 'number') return { value, reason: null };
  return value ? { value: null, reason: value } : WITHHELD;
}

/** A ward_scores row for an assembly seat; scores not given are withheld (too_few_reports). */
export function areaRow({ id = 's20-ac-1', name = id, reports = 0, scores = {} }: RowOptions = {}): AreaScores {
  return {
    area: { kind: 'assembly', id, name },
    counts: { verified_reports: reports, no_bin_reports: 0, sites: 1, open_sites: 1, cleaned_sites: 0, reopened_sites: 0 },
    min_verified_reports: 10,
    scores: { city: score(scores.city), citizen: score(scores.citizen), bin_access: score(scores.bin_access) },
    diagnosis: [],
    formula_version: 'scores-v1',
    pilot: true,
    data_window: { from: '2026-10-08T00:00:00Z', to: '2026-10-10T00:00:00Z' },
    computed_at: '2026-10-10T00:00:00Z',
  };
}
