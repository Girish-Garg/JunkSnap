import { GetCommand, UpdateCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ExternalServiceError, InternalDataError } from "../domain/errors.js";
import { isLapsed, type ExpiringSite } from "../domain/SiteExpiry.js";
import type { SiteExpirer } from "../ports/SiteExpirer.js";

// isLapsed judges the row in code, since a text compare of last_reported_at misreads offsets like +05:30 by hours;
// the update then holds only while the row is as read, so a vote or report that refreshed it meanwhile wins.
const STILL_LAPSED =
  "#status IN (:open, :reopened) AND verification <> :rejected AND " +
  "(expires_at < :now OR (attribute_not_exists(expires_at) AND last_reported_at = :seen))";
const NAMES = { "#status": "status" };

// A soft expiry: one conditional update of status, bumping version so the api and worker see the change.
export class DynamoSiteExpirer implements SiteExpirer {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.#client = client;
    this.#table = table;
  }

  async expire(siteId: string, now: Date): Promise<boolean> {
    const row = await this.#read(siteId);
    if (row === null || !isLapsed(row, now)) {
      return false;
    }
    const request = new UpdateCommand({
      TableName: this.#table,
      Key: { site_id: siteId },
      UpdateExpression: "SET #status = :expired, version = if_not_exists(version, :zero) + :one",
      ConditionExpression: STILL_LAPSED,
      ExpressionAttributeNames: NAMES,
      ExpressionAttributeValues: DynamoSiteExpirer.#values(now, row.last_reported_at),
    });
    try {
      await this.#client.send(request);
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
        return false;
      }
      throw new ExternalServiceError(`DynamoDB could not mark ${siteId} expired`, { cause: error });
    }
  }

  async #read(siteId: string): Promise<ExpiringSite | null> {
    const request = new GetCommand({
      TableName: this.#table,
      Key: { site_id: siteId },
      ProjectionExpression: "#status, verification, last_reported_at, expires_at",
      ExpressionAttributeNames: NAMES,
    });
    const { Item: item } = await this.#client.send(request).catch((error: unknown): never => {
      throw new ExternalServiceError(`DynamoDB could not read ${siteId}`, { cause: error });
    });
    return item === undefined ? null : DynamoSiteExpirer.#expiring(siteId, item);
  }

  static #expiring(siteId: string, item: Record<string, unknown>): ExpiringSite {
    const { status, verification, last_reported_at: lastReportedAt, expires_at: expiresAt } = item;
    if (typeof status !== "string" || typeof verification !== "string" || typeof lastReportedAt !== "string") {
      throw new InternalDataError(`site ${siteId} lacks status, verification or last_reported_at`);
    }
    const site = { status, verification, last_reported_at: lastReportedAt };
    return typeof expiresAt === "string" ? { ...site, expires_at: expiresAt } : site;
  }

  static #values(now: Date, seen: string): Record<string, string | number> {
    const statuses = { ":expired": "expired", ":open": "open", ":reopened": "reopened", ":rejected": "rejected" };
    return { ...statuses, ":now": now.toISOString(), ":seen": seen, ":zero": 0, ":one": 1 };
  }
}
