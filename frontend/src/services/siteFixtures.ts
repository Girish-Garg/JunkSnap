import type { SiteFeature } from '../domain/Site';

export type SiteFixtureLoaders = Readonly<Record<string, () => Promise<SiteFeature>>>;

export const siteFixtureLoaders: SiteFixtureLoaders = import.meta.glob<SiteFeature>(
  '../../../contracts/fixtures/site.*.json',
  { import: 'default' },
);
