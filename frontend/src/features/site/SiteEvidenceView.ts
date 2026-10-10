import { BinAccess } from '../../domain/BinAccess';
import type { SiteProperties } from '../../domain/Site';

export interface EvidenceLine {
  /** Key under site.* in the i18n files. */
  readonly key: string;
  readonly count?: number;
  readonly min?: number;
  /** Metres to the nearest known bin, for site.bin.nearest. */
  readonly metres?: number;
}

/** The site sheet's evidence lines: people who reported, the no-bin threshold and the nearest bin. */
export class SiteEvidenceView {
  static lines(site: SiteProperties): readonly EvidenceLine[] {
    return [...SiteEvidenceView.#reporters(site), ...SiteEvidenceView.#bin(site)];
  }

  // A no-bin zone's "n of 10" is the backers bar (decision 20261010-1630).
  static #reporters({ reporters }: SiteProperties): readonly EvidenceLine[] {
    return reporters === undefined ? [] : [{ key: 'reporters', count: reporters }];
  }

  static #bin({ report_type, insights }: SiteProperties): readonly EvidenceLine[] {
    const measure = report_type === 'no_bin' ? BinAccess.zoneLine : BinAccess.line;
    const line = BinAccess.applies(report_type) ? measure(insights?.nearest_bin, insights?.no_bin_within_3km) : null;
    if (!line) return [];
    return ['metres' in line ? { key: `bin.${line.key}`, metres: line.metres } : { key: `bin.${line.key}` }];
  }
}
