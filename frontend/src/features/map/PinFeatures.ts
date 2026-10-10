import type { Feature, FeatureCollection } from 'geojson';
import { BackersBadge } from '../../domain/BackersBadge';
import { HeatWeight } from '../../domain/HeatWeight';
import type { SiteFeature } from '../../domain/Site';
import type { PinGroup } from './PinGroups';

/** What a tap hit: one site's pin, or a stack of sites drawn as one pin. */
export type PinHit = { readonly kind: 'site'; readonly siteId: string } | { readonly kind: 'stack'; readonly siteIds: readonly string[] };

// MapLibre turns array properties into JSON text; site ids hold no commas, so a joined list reads back simply.
const ID_SEPARATOR = ',';

/** The GeoJSON the map sources hold. Nested properties do not reach MapLibre expressions, so values are added flat. */
export class PinFeatures {
  /** Every site: the heat, the no-bin zones and the selected pin read this. */
  static sites(sites: readonly SiteFeature[]): FeatureCollection {
    return PinFeatures.#collection(sites.map((site) => PinFeatures.#site(site)));
  }

  /** One feature per pin: a lone site as itself, a stack as one point with its count and lead type. */
  static pins(groups: readonly PinGroup[]): FeatureCollection {
    return PinFeatures.#collection(groups.map((group) => (group.sites.length === 1 ? PinFeatures.#site(group.sites[0] as SiteFeature) : PinFeatures.#stack(group))));
  }

  /** The image name a stack pin uses; SitesLayer registers one per type, solid and hollow. */
  static stackIcon(group: Pick<PinGroup, 'lead' | 'unverified'>): string {
    return `pin-stack-${group.unverified ? 'unverified-' : ''}${group.lead}`;
  }

  static hit(properties: Readonly<Record<string, unknown>> | undefined): PinHit | null {
    const stack = properties?.['stack_ids'];
    if (typeof stack === 'string' && stack) return { kind: 'stack', siteIds: stack.split(ID_SEPARATOR) };
    const siteId = properties?.['site_id'];
    return typeof siteId === 'string' ? { kind: 'site', siteId } : null;
  }

  static #site(site: SiteFeature): object {
    const flat = { heat_weight: HeatWeight.of(site.properties), backers_badge: BackersBadge.of(site.properties) };
    return { ...site, properties: { ...site.properties, ...flat } };
  }

  static #stack(group: PinGroup): object {
    const ids = group.sites.map((site) => site.properties.site_id);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [...group.position] },
      properties: { stack_ids: ids.join(ID_SEPARATOR), stack_count: ids.length, stack_icon: PinFeatures.stackIcon(group) },
    };
  }

  // MapLibre types want mutable GeoJSON but it only reads it.
  static #collection(features: readonly object[]): FeatureCollection {
    return { type: 'FeatureCollection', features: features as Feature[] };
  }
}
