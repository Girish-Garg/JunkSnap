import type { SiteFeature } from '../domain/Site';

export type SiteFixtureLoaders = Readonly<Record<string, () => Promise<SiteFeature>>>;

export const siteFixtureLoaders: SiteFixtureLoaders = import.meta.glob<SiteFeature>(
  '../../../contracts/fixtures/site.*.json',
  { import: 'default' },
);

/** Mock mode's sample report joins the jdh-1 site (contracts/README.md). */
export const sampleSiteLoader = (): Promise<SiteFeature> => import('../../../contracts/fixtures/site.jdh-1.json').then(
  (module) => module.default as unknown as SiteFeature,
);
