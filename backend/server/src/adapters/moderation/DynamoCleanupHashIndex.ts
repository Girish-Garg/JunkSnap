import { z } from "zod";
import { InternalDataError } from "../../domain/errors.js";
import { GeoPoint } from "../../domain/moderation/GeoPoint.js";
import { PerceptualHash } from "../../domain/moderation/PerceptualHash.js";
import type { PhotoSubmission } from "../../domain/moderation/PhotoSubmission.js";
import type { HashIndex, IndexedPhoto } from "../../ports/moderation/HashIndex.js";
import type { DynamoReader } from "./DynamoReader.js";

const CleanupItem = z.object({
  cleanup_id: z.string(),
  gps: z.object({ lat: z.number(), lon: z.number() }),
  moderation_result: z.object({ phash: z.string().regex(/^[0-9a-f]{16}$/) }),
});

// Earlier after-photos of the same site; the cleanups table has no site index, so this scans it with a filter.
export class DynamoCleanupHashIndex implements HashIndex {
  readonly #reader: DynamoReader;
  readonly #table: string;

  constructor(reader: DynamoReader, table: string) {
    this.#reader = reader;
    this.#table = table;
  }

  async earlierPhotos(submission: PhotoSubmission): Promise<IndexedPhoto[]> {
    const site = submission.fields.site;
    if (site === null) {
      throw new InternalDataError("cleanup duplicate check on a photo without a site");
    }
    const rows = await this.#reader.scan({
      TableName: this.#table,
      FilterExpression: "site_id = :site",
      ExpressionAttributeValues: { ":site": site.id },
      ProjectionExpression: "cleanup_id, gps, moderation_result.phash",
    });
    // A cleanup still being processed has no moderation_result yet.
    return rows
      .filter((row) => row.moderation_result !== undefined)
      .map((row) => {
        const cleanup = this.#reader.parse(CleanupItem, row, "cleanup");
        const location = new GeoPoint(cleanup.gps.lat, cleanup.gps.lon);
        return { photoId: cleanup.cleanup_id, hash: PerceptualHash.fromHex(cleanup.moderation_result.phash), location };
      });
  }
}
