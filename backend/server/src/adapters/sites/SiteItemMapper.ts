import { z } from "zod";
import { siteSchema, validateSite } from "../../contracts/index.gen.js";
import { InternalDataError } from "../../domain/errors.js";
import { Site } from "../../domain/sites/Site.js";
import type { SiteFeature } from "../../domain/sites/SiteTypes.js";
import type { NgeohashCells } from "./NgeohashCells.js";

export type SiteItem = Record<string, unknown>;

const PROPERTY_KEYS = Object.keys(siteSchema.properties.properties.properties);

// Site item fields outside the Feature (contracts/README.md, sites table).
const StoredExtras = z.object({
  lat: z.number(),
  lon: z.number(),
  report_ids: z.array(z.string()),
  reporter_devices: z.array(z.string()),
  me_too_count: z.int().min(0),
  embedding_key: z.string().nullable(),
  pending_cleanup_id: z.string().nullable(),
  version: z.int().min(1),
});

// A site item holds the Feature's properties top-level plus lat, lon, geohash4 and the internals.
export class SiteItemMapper {
  readonly #cells: NgeohashCells;

  constructor(cells: NgeohashCells) {
    this.#cells = cells;
  }

  // Writes the next version; the repository's condition checks the current one.
  toItem(site: Site): SiteItem {
    const { feature, internals } = site.snapshot();
    return {
      ...feature.properties,
      lat: site.point.lat,
      lon: site.point.lon,
      geohash4: this.#cells.cellOf(site.point),
      report_ids: internals.reportIds,
      reporter_devices: internals.reporterDevices,
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
    const extras = parsed.data;
    const properties = Object.fromEntries(PROPERTY_KEYS.filter((key) => key in item).map((key) => [key, item[key]]));
    const geometry = { type: "Point", coordinates: [extras.lon, extras.lat] };
    const feature = SiteItemMapper.#checked({ type: "Feature", geometry, properties });
    const internals = {
      reportIds: extras.report_ids,
      reporterDevices: extras.reporter_devices,
      meTooCount: extras.me_too_count,
      embeddingKey: extras.embedding_key,
      pendingCleanupId: extras.pending_cleanup_id,
      version: extras.version,
    };
    return Site.restore({ feature, internals });
  }

  static #checked(feature: unknown): SiteFeature {
    try {
      return validateSite(feature);
    } catch (error) {
      throw new InternalDataError("a stored site breaks the site contract", { cause: error });
    }
  }
}
