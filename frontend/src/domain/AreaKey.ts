import type { AreaKind } from './AreaScores';
import type { AreaRef, SiteFeature, SiteLocation } from './Site';

/** Smallest area first, the order the Areas tab lists them in. */
export const AREA_KINDS: readonly AreaKind[] = ['ward', 'assembly', 'loksabha', 'district'];

const FIELDS: Readonly<Record<AreaKind, (location: SiteLocation) => AreaRef | null>> = {
  ward: (location) => location.ward,
  assembly: (location) => location.assembly_seat,
  loksabha: (location) => location.loksabha_seat,
  district: (location) => location.district,
};

/** One area a site sits in; its id links to GET /areas/{kind}/{id}/scores. */
export class AreaKey {
  readonly kind: AreaKind;
  readonly id: string;
  readonly name: string;

  constructor(kind: AreaKind, id: string, name: string) {
    this.kind = kind;
    this.id = id;
    this.name = name;
  }

  static isKind(value: string): value is AreaKind {
    return (AREA_KINDS as readonly string[]).includes(value);
  }

  static fromLocation(location: SiteLocation): readonly AreaKey[] {
    return AREA_KINDS.flatMap((kind) => {
      const ref = FIELDS[kind](location);
      return ref ? [new AreaKey(kind, ref.id, ref.name)] : [];
    });
  }

  /** Each area of these sites once, smallest kind first, then by name. */
  static fromSites(sites: readonly SiteFeature[]): readonly AreaKey[] {
    const unique = new Map<string, AreaKey>();
    for (const site of sites) {
      for (const area of AreaKey.fromLocation(site.properties.location)) unique.set(area.key, area);
    }
    const rank = (area: AreaKey) => AREA_KINDS.indexOf(area.kind);
    return [...unique.values()].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }

  get key(): string {
    return `${this.kind}/${this.id}`;
  }

  holds(site: SiteFeature): boolean {
    return FIELDS[this.kind](site.properties.location)?.id === this.id;
  }

  /** The area's own id when it is a district, else null. */
  get districtId(): string | null {
    return this.kind === 'district' ? this.id : null;
  }

  /** The district this area lies in: its own, else the one district every given site of it is in, else null. */
  districtIn(sites: readonly SiteFeature[]): string | null {
    if (this.districtId) return this.districtId;
    const held = sites.filter((site) => this.holds(site));
    const ids = new Set(held.map((site) => site.properties.location.district.id));
    const [only] = ids;
    return ids.size === 1 && only ? only : null;
  }
}
