import { QueryCommand, type DynamoDBDocumentClient, type QueryCommandOutput } from "@aws-sdk/lib-dynamodb";
import { ExternalServiceError, InternalDataError, ValidationError } from "../domain/errors.js";
import { Report } from "../domain/Report.js";
import { ReportId } from "../domain/ReportId.js";
import type { ReportRecord } from "../domain/ReportRecord.js";
import type { UserReportLister, UserReportPage, UserReportPageRequest } from "../ports/UserReportLister.js";

type StartKey = Record<string, unknown>;

const KEY_NAMES = ["report_id", "user_id", "received_at"] as const;

// GET /me/reports on the reports by-user GSI (user_id, received_at), newest first. The cursor is the
// GSI's LastEvaluatedKey as base64url JSON, and it must name the asking user, so it never opens another user's rows.
export class DynamoUserReportLister implements UserReportLister {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.#client = client;
    this.#table = table;
  }

  async page(userId: string, request: UserReportPageRequest): Promise<UserReportPage> {
    const start = request.cursor === null ? undefined : DynamoUserReportLister.#decode(request.cursor, userId);
    const output = await this.#query(userId, request.limit, start);
    const reports = (output.Items ?? []).map((item) => Report.fromRecord(DynamoUserReportLister.#record(item, userId)));
    const last = output.LastEvaluatedKey;
    return { reports, nextCursor: last === undefined ? null : Buffer.from(JSON.stringify(last)).toString("base64url") };
  }

  async #query(userId: string, limit: number, start: StartKey | undefined): Promise<QueryCommandOutput> {
    const command = new QueryCommand({
      TableName: this.#table,
      IndexName: "by-user",
      KeyConditionExpression: "user_id = :user",
      FilterExpression: "capture_mode = :snap",
      ExpressionAttributeValues: { ":user": userId, ":snap": "snap" },
      ScanIndexForward: false,
      Limit: limit,
      ExclusiveStartKey: start,
    });
    try {
      return await this.#client.send(command);
    } catch (error) {
      throw new ExternalServiceError("Could not list the user's reports on by-user", { cause: error });
    }
  }

  static #decode(cursor: string, userId: string): StartKey {
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    } catch {
      throw new ValidationError("cursor is not a next_cursor from this route");
    }
    const key = parsed as Record<string, unknown> | null;
    const keys = key !== null && typeof key === "object" ? Object.keys(key).sort() : [];
    const shaped = keys.join() === [...KEY_NAMES].sort().join() && KEY_NAMES.every((name) => typeof key?.[name] === "string");
    if (!shaped || key?.user_id !== userId) {
      throw new ValidationError("cursor is not a next_cursor from this route");
    }
    return key as StartKey;
  }

  // The GSI holds only this user's rows; a row naming anyone else is a broken index, never shown.
  static #record(item: Record<string, unknown>, userId: string): ReportRecord {
    const valid = ReportId.isValid(item.report_id) && typeof item.status === "string" && item.user_id === userId;
    if (!valid || !Array.isArray(item.completed_steps)) {
      throw new InternalDataError(`reports item ${String(item.report_id)} on by-user is malformed`);
    }
    return item as unknown as ReportRecord;
  }
}
