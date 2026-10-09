import { QueryCommand, type DynamoDBDocumentClient, type QueryCommandOutput } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { ExternalServiceError, InternalDataError } from "../domain/errors.js";
import type { AreaReportReader } from "../ports/AreaReportReader.js";

const BY_SITE_INDEX = "by-site";

const ReportItem = z.object({ status: z.string(), captured_at: z.iso.datetime() });

// Reads the reports table's by-site index; a report's status follows its site once merged.
export class DynamoAreaReportReader implements AreaReportReader {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.#client = client;
    this.#table = table;
  }

  async verifiedReportTimes(siteId: string): Promise<number[]> {
    const times: number[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await this.#query(siteId, startKey);
      times.push(...(page.Items ?? []).flatMap((item) => DynamoAreaReportReader.#verifiedTime(siteId, item)));
      startKey = page.LastEvaluatedKey;
    } while (startKey !== undefined);
    return times;
  }

  static #verifiedTime(siteId: string, item: Record<string, unknown>): number[] {
    const parsed = ReportItem.safeParse(item);
    if (!parsed.success) {
      throw new InternalDataError(`reports item on ${siteId}: ${z.prettifyError(parsed.error)}`);
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
