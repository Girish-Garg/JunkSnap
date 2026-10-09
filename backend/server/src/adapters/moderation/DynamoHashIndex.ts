import { type DynamoDBDocumentClient, QueryCommand, type QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import ngeohash from "ngeohash";
import { z } from "zod";
import { GeoPoint } from "../../domain/moderation/GeoPoint.js";
import { PerceptualHash } from "../../domain/moderation/PerceptualHash.js";
import type { HashIndex, IndexedPhoto } from "../../ports/moderation/HashIndex.js";
import { callService } from "./utils.js";

export interface HashTables {
  readonly reports: string;
  readonly sites: string;
}

// Reports merge into sites within 40 m, so a site that far beyond the radius can still hold a nearby report.
const SITE_SPREAD_M = 40;
const GEOHASH_PRECISION = 4;
const METRES_PER_DEGREE = 111_320;

const SiteItem = z.object({ site_id: z.string(), lat: z.number(), lon: z.number() });
// A report still being processed has no moderation_result yet, so it fails this shape and is left out.
const ReportItem = z.object({
  report_id: z.string(),
  gps: z.object({ lat: z.number(), lon: z.number() }),
  moderation_result: z.object({ phash: z.string().regex(/^[0-9a-f]{16}$/) }),
});

// Reads pHashes through the sites by-geohash and reports by-site indexes; reports not yet merged into a site are not seen.
export class DynamoHashIndex implements HashIndex {
  readonly #client: DynamoDBDocumentClient;
  readonly #tables: HashTables;

  constructor(client: DynamoDBDocumentClient, tables: HashTables) {
    this.#client = client;
    this.#tables = tables;
  }

  async near(point: GeoPoint, radiusM: number): Promise<IndexedPhoto[]> {
    const siteIds = await this.#sitesNear(point, radiusM + SITE_SPREAD_M);
    const photos = await Promise.all(siteIds.map((siteId) => this.#photosAt(siteId)));
    return photos.flat();
  }

  async #sitesNear(point: GeoPoint, radiusM: number): Promise<string[]> {
    const dLat = radiusM / METRES_PER_DEGREE;
    const dLon = radiusM / (METRES_PER_DEGREE * Math.cos((point.lat * Math.PI) / 180));
    const cells = ngeohash.bboxes(point.lat - dLat, point.lon - dLon, point.lat + dLat, point.lon + dLon, GEOHASH_PRECISION);
    const pages = await Promise.all(cells.map((cell) => this.#queryAll(this.#siteQuery(cell))));
    return pages
      .flat()
      .flatMap((item) => SiteItem.safeParse(item).data ?? [])
      .filter((site) => new GeoPoint(site.lat, site.lon).distanceTo(point) <= radiusM)
      .map((site) => site.site_id);
  }

  async #photosAt(siteId: string): Promise<IndexedPhoto[]> {
    const items = await this.#queryAll({
      TableName: this.#tables.reports,
      IndexName: "by-site",
      KeyConditionExpression: "site_id = :site",
      ExpressionAttributeValues: { ":site": siteId },
      ProjectionExpression: "report_id, gps, moderation_result.phash",
    });
    return items.flatMap((item) => {
      const report = ReportItem.safeParse(item).data;
      return report === undefined ? [] : [this.#toPhoto(report)];
    });
  }

  #siteQuery(cell: string): QueryCommandInput {
    return {
      TableName: this.#tables.sites,
      IndexName: "by-geohash",
      KeyConditionExpression: "geohash4 = :cell",
      ExpressionAttributeValues: { ":cell": cell },
      ProjectionExpression: "site_id, lat, lon",
    };
  }

  #toPhoto(report: z.infer<typeof ReportItem>): IndexedPhoto {
    const location = new GeoPoint(report.gps.lat, report.gps.lon);
    return { photoId: report.report_id, hash: PerceptualHash.fromHex(report.moderation_result.phash), location };
  }

  async #queryAll(input: QueryCommandInput): Promise<Record<string, unknown>[]> {
    const items: Record<string, unknown>[] = [];
    let start: Record<string, unknown> | undefined;
    do {
      const command = new QueryCommand({ ...input, ExclusiveStartKey: start });
      const page = await callService(`DynamoDB query ${input.IndexName ?? ""}`, () => this.#client.send(command));
      items.push(...(page.Items ?? []));
      start = page.LastEvaluatedKey;
    } while (start !== undefined);
    return items;
  }
}
