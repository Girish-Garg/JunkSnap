import type { AreaListing } from '../domain/AreaListing';
import type { AreaScores } from '../domain/AreaScores';

/** Each loader gives scores rows; ward_scores fixtures come first, so they win over a list's copy of the same area. */
export type AreaFixtureLoaders = Readonly<Record<string, () => Promise<readonly AreaScores[]>>>;

const rows = import.meta.glob<AreaScores>('../../../contracts/fixtures/ward_scores.*.json', { import: 'default' });
const lists = import.meta.glob<AreaListing>('../../../contracts/fixtures/area_list.*.json', { import: 'default' });

export const areaFixtureLoaders: AreaFixtureLoaders = {
  ...Object.fromEntries(Object.entries(rows).map(([path, load]) => [path, async () => [await load()]])),
  ...Object.fromEntries(Object.entries(lists).map(([path, load]) => [path, async () => (await load()).areas])),
};
