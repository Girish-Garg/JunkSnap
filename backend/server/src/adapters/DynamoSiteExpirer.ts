import { UpdateCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ExternalServiceError } from "../domain/errors.js";
import { lapseCutoff } from "../domain/SiteExpiry.js";
import type { SiteExpirer } from "../ports/SiteExpirer.js";

// The same rule as isLapsed in SiteExpiry.ts, so a vote or report that refreshed expires_at meanwhile wins.
// Rows without expires_at expire 90 days after last_reported_at.
const STILL_LAPSED =
  "#status IN (:open, :reopened) AND verification <> :rejected AND " +
  "(expires_at < :now OR (attribute_not_exists(expires_at) AND last_reported_at < :cutoff))";

// A soft expiry: one conditional update of status, bumping version so the api and worker see the change.
export class DynamoSiteExpirer implements SiteExpirer {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.#client = client;
    this.#table = table;
  }

  async expire(siteId: string, now: Date): Promise<boolean> {
    const request = new UpdateCommand({
      TableName: this.#table,
      Key: { site_id: siteId },
      UpdateExpression: "SET #status = :expired, version = if_not_exists(version, :zero) + :one",
      ConditionExpression: STILL_LAPSED,
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: DynamoSiteExpirer.#values(now),
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

  static #values(now: Date): Record<string, string | number> {
    const statuses = { ":expired": "expired", ":open": "open", ":reopened": "reopened", ":rejected": "rejected" };
    return { ...statuses, ":now": now.toISOString(), ":cutoff": lapseCutoff(now), ":zero": 0, ":one": 1 };
  }
}
