import { z } from "zod";
import { siteSchema, validateSite } from "../../contracts/index.gen.js";
import { InternalDataError } from "../../domain/errors.js";
import { Site } from "../../domain/sites/Site.js";
import type { MergedReport, ReportInsights, SiteFeature, SiteInternals } from "../../domain/sites/SiteTypes.js";
import type { Logger } from "../../ports/Logger.js";
import type { NgeohashCells } from "./NgeohashCells.js";

export type SiteItem = Record<string, unknown>;

const PROPERTY_KEYS = Object.keys(siteSchema.properties.properties.properties);

// Shape check only: these were validated as verification_result.insights before they were stored.
const StoredInsights = z.custom<ReportInsights>(
  (value) => typeof value === "object" && value !== null && "composition" in value && "hazards" in value,
);

// Fields outside the Feature (contracts/README.md, sites table); defaults let older items load.
const StoredExtras = z.object({
  lat: z.number(),
  lon: z.number(),
  report_ids: z.array(z.string()).default([]),
  merged_reports: z
    .array(z.object({ report_id: z.string(), verified: z.boolean(), insights: StoredInsights.nullable() }))
    .optional(),
  reporter_devices: z.array(z.string()).default([]),
  reporter_users: z.array(z.string()).default([]),
  reporter_ids: z.array(z.string()).optional(),
  me_too_count: z.int().min(0).default(0),
  embedding_key: z.string().nullable().default(null),
  pending_cleanup_id: z.string().nullable().default(null),
  version: z.int().min(0).default(0),
});

type Extras = z.output<typeof StoredExtras>;

// A site item holds the Feature's properties top-level plus lat, lon, geohash4 and the internals.
export class SiteItemMapper {
  readonly #cells: NgeohashCells;
  readonly #logger: Logger;

  constructor(cells: NgeohashCells, logger: Logger) {
    this.#cells = cells;
    this.#logger = logger;
  }

  // Writes the next version; the repository's condition checks the current one.
  toItem(site: Site): SiteItem {
    const { feature, internals } = site.snapshot();
    const reports = internals.reports;
    return {
      ...feature.properties,
      lat: site.point.lat,
      lon: site.point.lon,
      geohash4: this.#cells.cellOf(site.point),
      report_ids: reports.map((report) => report.reportId),
      merged_reports: reports.map(({ reportId, verified, insights }) => ({ report_id: reportId, verified, insights })),
      reporter_devices: internals.reporterDevices,
      reporter_users: internals.reporterUsers,
      reporter_ids: internals.reporterIds,
      me_too_count: internals.meTooCount,
      embedding_key: internals.embeddingKey,
      pending_cleanup_id: internals.pendingCleanupId,
      version: internals.version + 1,
    };
  }

  toSite(item: SiteItem): Site {
    const parsed = StoredExtras.safeParse(item);
    if (!parsed.success) {
      throw new InternalDataError(`site item ${String(item.site_id)} is malformed: ${z.prettifyError(parsed.error)}`);
    }
    const properties = Object.fromEntries(PROPERTY_KEYS.filter((key) => key in item).map((key) => [key, item[key]]));
    const geometry = { type: "Point", coordinates: [parsed.data.lon, parsed.data.lat] };
    const feature = SiteItemMapper.#checked({ type: "Feature", geometry, properties });
    return Site.restore({ feature, internals: SiteItemMapper.#internals(parsed.data) });
  }

  // For lists: one bad item is logged and left out instead of failing the whole answer.
  toListedSite(item: SiteItem): Site | null {
    try {
      return this.toSite(item);
    } catch (error) {
      if (!(error instanceof InternalDataError)) {
        throw error;
      }
      this.#logger.warn({ site_id: String(item.site_id), error: error.message }, "skipped a stored site");
      return null;
    }
  }

  static #internals(extras: Extras): SiteInternals {
    return {
      reports: SiteItemMapper.#reports(extras),
      reporterDevices: extras.reporter_devices,
      reporterUsers: extras.reporter_users,
      // Older items only know devices.
      reporterIds: extras.reporter_ids ?? extras.reporter_devices,
      meTooCount: extras.me_too_count,
      embeddingKey: extras.embedding_key,
      pendingCleanupId: extras.pending_cleanup_id,
      version: extras.version,
    };
  }

  // An item from before merged_reports has only ids; they start unverified, with no insights.
  static #reports(extras: Extras): MergedReport[] {
    const stored = extras.merged_reports;
    if (stored === undefined) {
      return extras.report_ids.map((reportId) => ({ reportId, verified: false, insights: null }));
    }
    return stored.map((report) => ({ reportId: report.report_id, verified: report.verified, insights: report.insights }));
  }

  static #checked(feature: unknown): SiteFeature {
    try {
      return validateSite(feature);
    } catch (error) {
      throw new InternalDataError("a stored site breaks the site contract", { cause: error });
    }
  }
}
