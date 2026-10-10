import { QueryCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { InternalDataError } from "../../domain/errors.js";
import type { PublicMedia } from "../../domain/sites/PublicMedia.js";
import type { SiteReportRef } from "../../domain/sites/Withdrawal.js";
import type { SiteReportReader } from "../../ports/sites/SiteReportReader.js";
import type { AwsCalls } from "./AwsCalls.js";

const BY_SITE_INDEX = "by-site";
// The same bar as site.brands: only labels read with confidence 0.8 or more.
const READABLE = 0.8;

const StoredRow = z.object({
  report_id: z.string(),
  user_id: z.string().optional(),
  device_token: z.string(),
  captured_at: z.string(),
  brand_labels: z
    .array(z.object({ brand: z.string(), parent_company: z.string(), confidence: z.number(), mapping_source_url: z.string() }))
    .default([]),
  moderation_result: z.object({ blurred_key: z.string().nullable().optional() }).nullable().optional(),
});

type Row = z.output<typeof StoredRow>;

// Reads the reports table's by-site index; every GSI projects all attributes (contracts/README.md).
export class DynamoSiteReportReader implements SiteReportReader {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;
  readonly #media: PublicMedia;
  readonly #calls: AwsCalls;

  constructor(client: DynamoDBDocumentClient, table: string, media: PublicMedia, calls: AwsCalls) {
    this.#client = client;
    this.#table = table;
    this.#media = media;
    this.#calls = calls;
  }

  async forSite(siteId: string): Promise<SiteReportRef[]> {
    const rows: SiteReportRef[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const request = new QueryCommand({
        TableName: this.#table,
        IndexName: BY_SITE_INDEX,
        KeyConditionExpression: "site_id = :site",
        ExpressionAttributeValues: { ":site": siteId },
        ExclusiveStartKey: startKey,
      });
      const page = await this.#calls.run("DynamoDB query reports by site", () => this.#client.send(request));
      rows.push(...(page.Items ?? []).map((item) => this.#toRef(siteId, item)));
      startKey = page.LastEvaluatedKey;
    } while (startKey !== undefined);
    return rows;
  }

  #toRef(siteId: string, item: Record<string, unknown>): SiteReportRef {
    const parsed = StoredRow.safeParse(item);
    if (!parsed.success) {
      throw new InternalDataError(`reports item on ${siteId}: ${z.prettifyError(parsed.error)}`);
    }
    const row: Row = parsed.data;
    const blurredKey = row.moderation_result?.blurred_key ?? null;
    return {
      reportId: row.report_id,
      userId: row.user_id ?? null,
      deviceToken: row.device_token,
      reportedAt: row.captured_at,
      brands: row.brand_labels
        .filter((label) => label.confidence >= READABLE)
        .map(({ brand, parent_company, confidence, mapping_source_url }) => ({ brand, parent_company, confidence, source_url: mapping_source_url })),
      photoUrl: blurredKey === null ? null : this.#media.urlFor(blurredKey),
    };
  }
}
