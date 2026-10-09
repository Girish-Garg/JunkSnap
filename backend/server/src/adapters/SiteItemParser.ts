import { siteSchema, validateSite, type Site } from "../contracts/index.gen.js";
import type { AreaKind, AreaRef } from "../domain/AreaKey.js";
import { AreaSite } from "../domain/AreaSite.js";
import { InternalDataError } from "../domain/errors.js";
import { GeoPoint } from "../domain/GeoPoint.js";

type Location = Site["properties"]["location"];

const SITE_FIELDS = Object.keys(siteSchema.properties.properties.properties);

// A sites-table item is the site properties plus lat, lon and private fields; it must pass the site contract.
export class SiteItemParser {
  parse(item: Record<string, unknown>): AreaSite {
    const properties = Object.fromEntries(SITE_FIELDS.filter((field) => field in item).map((field) => [field, item[field]]));
    const feature = { type: "Feature", geometry: { type: "Point", coordinates: [item.lon, item.lat] }, properties };
    return SiteItemParser.#toSite(SiteItemParser.#checked(feature, String(item.site_id)));
  }

  static #checked(feature: object, siteId: string): Site {
    try {
      return validateSite(feature);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new InternalDataError(`sites item ${siteId} breaks the site contract: ${detail}`, { cause: error });
    }
  }

  static #toSite({ geometry, properties: site }: Site): AreaSite {
    const [lon, lat] = geometry.coordinates;
    return new AreaSite({
      siteId: site.site_id,
      reportType: site.report_type,
      context: site.context,
      status: site.status,
      verification: site.verification,
      verifiedCount: site.verified_count,
      firstReportedAt: site.first_reported_at,
      cleanedAt: site.cleaned_at,
      pilot: site.pilot,
      burning: site.burning,
      point: new GeoPoint(lat, lon),
      localBodyId: site.location.local_body?.id ?? null,
      areas: SiteItemParser.#areas(site.location),
      brands: site.brands.map((label) => ({ brand: label.brand, parentCompany: label.parent_company, confidence: label.confidence })),
      insights: site.insights ?? null,
      reportTimes: [],
    });
  }

  static #areas(location: Location): AreaRef[] {
    const refs: [AreaKind, { id: string; name: string } | null][] = [
      ["ward", location.ward],
      ["assembly", location.assembly_seat],
      ["loksabha", location.loksabha_seat],
      ["district", location.district],
    ];
    return refs.flatMap(([kind, ref]) => (ref ? [{ kind, id: ref.id, name: ref.name }] : []));
  }
}
