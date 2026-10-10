import type { AreaScores } from '../domain/AreaScores';

export type AreaFixtureLoaders = Readonly<Record<string, () => Promise<AreaScores>>>;

export const areaFixtureLoaders: AreaFixtureLoaders = import.meta.glob<AreaScores>(
  '../../../contracts/fixtures/ward_scores.*.json',
  { import: 'default' },
);
