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
  static lines(site: SiteProperties, zoneRadiusM: number): readonly EvidenceLine[] {
    return [...SiteEvidenceView.reporters(site), ...SiteEvidenceView.bin(site, zoneRadiusM)];
  }

  // A no-bin zone's "n of 10" is the backers bar (decision 20261010-1630).
  static reporters({ reporters }: SiteProperties): readonly EvidenceLine[] {
    return reporters === undefined ? [] : [{ key: 'reporters', count: reporters }];
  }

  /** The nearest known bin, under its own heading on the sheet; a no-bin zone (zoneRadiusM) names a bin inside it. */
  static bin({ report_type, insights }: SiteProperties, zoneRadiusM: number): readonly EvidenceLine[] {
    if (!BinAccess.applies(report_type)) return [];
    const nearest = insights?.nearest_bin;
    const noBin = insights?.no_bin_within_3km;
    const line = report_type === 'no_bin' ? BinAccess.zoneLine(nearest, noBin, zoneRadiusM) : BinAccess.line(nearest, noBin);
    if (!line) return [];
    return ['metres' in line ? { key: `bin.${line.key}`, metres: line.metres } : { key: `bin.${line.key}` }];
  }
}
