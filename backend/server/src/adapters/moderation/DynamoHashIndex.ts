import ngeohash from "ngeohash";
import { z } from "zod";
import { GeoPoint } from "../../domain/moderation/GeoPoint.js";
import { PerceptualHash } from "../../domain/moderation/PerceptualHash.js";
import type { PhotoSubmission } from "../../domain/moderation/PhotoSubmission.js";
import type { HashIndex, IndexedPhoto } from "../../ports/moderation/HashIndex.js";
import type { DynamoReader } from "./DynamoReader.js";

export interface HashTables {
  readonly reports: string;
  readonly sites: string;
}

const GEOHASH_PRECISION = 4;
const METRES_PER_DEGREE = 111_320;

const SiteItem = z.object({ site_id: z.string(), lat: z.number(), lon: z.number() });
const ReportItem = z.object({
  report_id: z.string(),
  gps: z.object({ lat: z.number(), lon: z.number() }),
  moderation_result: z.object({ phash: z.string().regex(/^[0-9a-f]{16}$/) }),
});

// Report photos, through the sites by-geohash and reports by-site indexes; reports not yet merged into a site are not seen.
export class DynamoHashIndex implements HashIndex {
  readonly #reader: DynamoReader;
  readonly #tables: HashTables;
  readonly #siteSpreadM: number;

  // Reports merge into sites within SITE_MERGE_RADIUS_M of their spot, and a long-range spot is up to TARGET_MAX_M from
  // where the reporter stood (decision 20261011-0400), so a site siteSpreadM (their sum) beyond the radius can still
  // hold a nearby photo.
  constructor(reader: DynamoReader, tables: HashTables, siteSpreadM: number) {
    this.#reader = reader;
    this.#tables = tables;
    this.#siteSpreadM = siteSpreadM;
  }

  async earlierPhotos(submission: PhotoSubmission, radiusM: number): Promise<IndexedPhoto[]> {
    const siteIds = await this.#sitesNear(submission.fields.location, radiusM + this.#siteSpreadM);
    const photos = await Promise.all(siteIds.map((siteId) => this.#photosAt(siteId)));
    return photos.flat();
  }

  async #sitesNear(point: GeoPoint, radiusM: number): Promise<string[]> {
    const dLat = radiusM / METRES_PER_DEGREE;
    const dLon = radiusM / (METRES_PER_DEGREE * Math.cos((point.lat * Math.PI) / 180));
    const cells = ngeohash.bboxes(point.lat - dLat, point.lon - dLon, point.lat + dLat, point.lon + dLon, GEOHASH_PRECISION);
    const pages = await Promise.all(
      cells.map((cell) =>
        this.#reader.query({
          TableName: this.#tables.sites,
          IndexName: "by-geohash",
          KeyConditionExpression: "geohash4 = :cell",
          ExpressionAttributeValues: { ":cell": cell },
          ProjectionExpression: "site_id, lat, lon",
        }),
      ),
    );
    return pages
      .flat()
      .map((row) => this.#reader.parse(SiteItem, row, "site"))
      .filter((site) => new GeoPoint(site.lat, site.lon).distanceTo(point) <= radiusM)
      .map((site) => site.site_id);
  }

  async #photosAt(siteId: string): Promise<IndexedPhoto[]> {
    const rows = await this.#reader.query({
      TableName: this.#tables.reports,
      IndexName: "by-site",
      KeyConditionExpression: "site_id = :site",
      ExpressionAttributeValues: { ":site": siteId },
      ProjectionExpression: "report_id, gps, moderation_result.phash",
    });
    // A report still being processed has no moderation_result yet.
    return rows
      .filter((row) => row.moderation_result !== undefined)
      .map((row) => {
        const report = this.#reader.parse(ReportItem, row, "report");
        const location = new GeoPoint(report.gps.lat, report.gps.lon);
        return { photoId: report.report_id, hash: PerceptualHash.fromHex(report.moderation_result.phash), location };
      });
  }
}
