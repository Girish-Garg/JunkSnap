import { QueryCommand, type DynamoDBDocumentClient, type QueryCommandOutput } from "@aws-sdk/lib-dynamodb";
import { ExternalServiceError, ValidationError } from "../domain/errors.js";
import { Report } from "../domain/Report.js";
import { ReportId } from "../domain/ReportId.js";
import type { ReportRecord } from "../domain/ReportRecord.js";
import type { Logger } from "../ports/Logger.js";
import type { UserReportLister, UserReportPage, UserReportPageRequest } from "../ports/UserReportLister.js";

type StartKey = Record<string, unknown>;

interface Listed {
  readonly report: Report;
  readonly key: StartKey;
}

interface Collected {
  readonly listed: readonly Listed[];
  readonly next: StartKey | undefined;
}

const KEY_NAMES = ["report_id", "user_id", "received_at"] as const;

// GET /me/reports on the reports by-user GSI (user_id, received_at), newest first. The cursor is a by-user key
// (report_id, user_id, received_at) as base64url JSON, and it must name the asking user, so it never opens another user's rows.
export class DynamoUserReportLister implements UserReportLister {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;
  readonly #logger: Logger;
  readonly #maxRounds: number;

  // maxRounds: MY_REPORTS_MAX_ROUNDS. Limit applies before the snap filter, so a recent scan's frames can fill whole
  // rounds; this caps the reads per page.
  constructor(client: DynamoDBDocumentClient, table: string, logger: Logger, maxRounds: number) {
    this.#client = client;
    this.#table = table;
    this.#logger = logger;
    this.#maxRounds = maxRounds;
  }

  async page(userId: string, request: UserReportPageRequest): Promise<UserReportPage> {
    const start = request.cursor === null ? undefined : DynamoUserReportLister.#decode(request.cursor, userId);
    const { listed, next } = await this.#collect(userId, request.limit, start);
    const shown = listed.slice(0, request.limit);
    // After reading past the page, resume after the last report shown, never at DynamoDB's key.
    const resume = listed.length > request.limit ? shown.at(-1)?.key : next;
    const nextCursor = resume === undefined ? null : Buffer.from(JSON.stringify(resume)).toString("base64url");
    return { reports: shown.map((each) => each.report), nextCursor };
  }

  // Queries until the page is full or by-user has no more rows, at most maxRounds times.
  async #collect(userId: string, limit: number, first: StartKey | undefined): Promise<Collected> {
    const listed: Listed[] = [];
    let next = first;
    for (let round = 0; round < this.#maxRounds; round += 1) {
      const output = await this.#query(userId, limit, next);
      listed.push(...(output.Items ?? []).flatMap((item) => this.#listed(item, userId)));
      next = output.LastEvaluatedKey;
      if (next === undefined || listed.length >= limit) {
        break;
      }
    }
    return { listed, next };
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

  // The GSI holds only this user's rows. A malformed row, or one naming anyone else, is skipped with a
  // warning (never shown), so one bad row cannot hide the rest of the user's list.
  #listed(item: Record<string, unknown>, userId: string): Listed[] {
    const valid = ReportId.isValid(item.report_id) && typeof item.status === "string" && Array.isArray(item.completed_steps);
    if (valid && item.user_id === userId) {
      const key = { report_id: item.report_id, user_id: userId, received_at: item.received_at };
      return [{ report: Report.fromRecord(item as unknown as ReportRecord), key }];
    }
    const reason = valid ? "another user's row" : "malformed row";
    this.#logger.warn({ report_id: String(item.report_id), index: "by-user", reason }, "skipped a listed report");
    return [];
  }
}
