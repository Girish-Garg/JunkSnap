import { QueryCommand, type DynamoDBDocumentClient, type QueryCommandOutput } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { ExternalServiceError } from "../domain/errors.js";
import type { AreaReportReader } from "../ports/AreaReportReader.js";
import type { Logger } from "../ports/Logger.js";

const BY_SITE_INDEX = "by-site";

// The api's ajv date-time check accepts an offset such as +05:30, so the reader must too.
const ReportItem = z.object({ status: z.string(), captured_at: z.iso.datetime({ offset: true }) });

// Reads the reports table's by-site index; a report's status follows its site once merged.
export class DynamoAreaReportReader implements AreaReportReader {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;
  readonly #logger: Logger;

  constructor(client: DynamoDBDocumentClient, table: string, logger: Logger) {
    this.#client = client;
    this.#table = table;
    this.#logger = logger;
  }

  async verifiedReportTimes(siteId: string): Promise<number[]> {
    const times: number[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await this.#query(siteId, startKey);
      times.push(...(page.Items ?? []).flatMap((item) => this.#verifiedTime(siteId, item)));
      startKey = page.LastEvaluatedKey;
    } while (startKey !== undefined);
    return times;
  }

  // One malformed row is skipped with a warning, so it cannot stop the scores of every area its site is in.
  #verifiedTime(siteId: string, item: Record<string, unknown>): number[] {
    const parsed = ReportItem.safeParse(item);
    if (!parsed.success) {
      const error = z.prettifyError(parsed.error);
      this.#logger.warn({ site_id: siteId, report_id: String(item.report_id), index: BY_SITE_INDEX, error }, "skipped a report row");
      return [];
    }
    return parsed.data.status === "verified" ? [Date.parse(parsed.data.captured_at)] : [];
  }

  async #query(siteId: string, startKey: Record<string, unknown> | undefined): Promise<QueryCommandOutput> {
    const command = new QueryCommand({
      TableName: this.#table,
      IndexName: BY_SITE_INDEX,
      KeyConditionExpression: "site_id = :site",
      ExpressionAttributeValues: { ":site": siteId },
      ExclusiveStartKey: startKey,
    });
    try {
      return await this.#client.send(command);
    } catch (error) {
      throw new ExternalServiceError("DynamoDB query of the reports by-site index failed", { cause: error });
    }
  }
}
