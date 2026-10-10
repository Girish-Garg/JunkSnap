import type { AreaLetterDraft } from '../domain/AreaLetter';
import type { LetterDraft } from '../domain/SiteActions';
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

/** Mock mode's letter draft (contracts/fixtures/letter_draft.jdh-1.json). */
export const sampleLetterLoader = (): Promise<LetterDraft> => import('../../../contracts/fixtures/letter_draft.jdh-1.json').then(
  (module) => module.default as unknown as LetterDraft,
);

/** Mock mode's area letter (contracts/fixtures/area_letter_draft.jdh-1.json). */
export const sampleAreaLetterLoader = (): Promise<AreaLetterDraft> => import('../../../contracts/fixtures/area_letter_draft.jdh-1.json').then(
  (module) => module.default as unknown as AreaLetterDraft,
);
