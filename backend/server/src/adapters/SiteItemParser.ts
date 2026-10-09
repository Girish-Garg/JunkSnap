import { z } from "zod";
import { MATERIALS } from "../domain/AreaInsights.js";
import type { AreaKind, AreaRef } from "../domain/AreaKey.js";
import { AreaSite, REPORT_TYPES, SITE_STATUSES, VERIFICATIONS } from "../domain/AreaSite.js";
import { InternalDataError } from "../domain/errors.js";
import { GeoPoint } from "../domain/GeoPoint.js";
import { PLACE_KINDS } from "../domain/SensitivePlace.js";

const areaRef = z.object({ id: z.string().regex(/^[a-z0-9-]{1,64}$/), name: z.string() }).nullish();

// Only the fields scores read; a missing area or cleaned_at counts as null (assembly_seat is null outside Rajasthan).
const SiteItem = z.object({
  site_id: z.string().min(1),
  report_type: z.enum(REPORT_TYPES),
  context: z.string(),
  status: z.enum(SITE_STATUSES),
  verification: z.enum(VERIFICATIONS),
  verified_count: z.number().int().min(0),
  first_reported_at: z.iso.datetime(),
  cleaned_at: z.iso.datetime().nullish(),
  pilot: z.boolean(),
  burning: z.boolean(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  location: z.object({ ward: areaRef, assembly_seat: areaRef, loksabha_seat: areaRef, district: areaRef }),
  brands: z.array(z.object({ brand: z.string(), parent_company: z.string(), confidence: z.number() })),
  insights: z
    .object({
      reports: z.number().int().min(0),
      composition: z.array(z.object({ material: z.enum(MATERIALS), share_pct: z.number().min(0).max(100) })),
      hazards: z.array(z.object({ hazard: z.string() })),
      near: z.array(z.object({ kind: z.enum(PLACE_KINDS), distance_m: z.number().min(0) })),
    })
    .nullish(),
});

type SiteItemShape = z.output<typeof SiteItem>;

// A sites-table item (site properties plus lat and lon) as an AreaSite; a bad item is our bug, never skipped.
export class SiteItemParser {
  parse(item: Record<string, unknown>): AreaSite {
    const parsed = SiteItem.safeParse(item);
    if (!parsed.success) {
      throw new InternalDataError(`sites item ${String(item.site_id)}: ${z.prettifyError(parsed.error)}`);
    }
    return SiteItemParser.#toSite(parsed.data);
  }

  static #toSite(item: SiteItemShape): AreaSite {
    return new AreaSite({
      siteId: item.site_id,
      reportType: item.report_type,
      context: item.context,
      status: item.status,
      verification: item.verification,
      verifiedCount: item.verified_count,
      firstReportedAt: item.first_reported_at,
      cleanedAt: item.cleaned_at ?? null,
      pilot: item.pilot,
      burning: item.burning,
      point: new GeoPoint(item.lat, item.lon),
      areas: SiteItemParser.#areas(item.location),
      brands: item.brands.map((label) => ({ brand: label.brand, parentCompany: label.parent_company, confidence: label.confidence })),
      insights: item.insights ?? null,
      reportTimes: [],
    });
  }

  static #areas(location: SiteItemShape["location"]): AreaRef[] {
    const refs: [AreaKind, z.output<typeof areaRef>][] = [
      ["ward", location.ward],
      ["assembly", location.assembly_seat],
      ["loksabha", location.loksabha_seat],
      ["district", location.district],
    ];
    return refs.flatMap(([kind, ref]) => (ref ? [{ kind, id: ref.id, name: ref.name }] : []));
  }
}
