import type { WardCoverage } from '../../services/BoundaryCatalog';

type Translate = (key: string, params?: Readonly<Record<string, string>>) => string;
type FormatNumber = (value: number) => string;

/** "Approximate ward areas from official ward lists, unreviewed (34 of 100 wards)", one count per city mapped. */
export class WardCoverageText {
  static of(coverage: readonly WardCoverage[], t: Translate, number: FormatNumber): string {
    if (coverage.length === 0) return t('boundaries.wardsApprox');
    const one = coverage.length === 1;
    const parts = coverage.map((body) => {
      const counts = body.wards === null
        ? t('boundaries.wardsMapped', { mapped: number(body.mapped) })
        : t('boundaries.wardsOf', { mapped: number(body.mapped), wards: number(body.wards) });
      return one ? counts : `${body.town}: ${counts}`;
    });
    return t('boundaries.wardsApproxCounted', { counts: parts.join('; ') });
  }
}
