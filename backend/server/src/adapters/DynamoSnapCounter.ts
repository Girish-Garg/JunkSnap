import { QueryCommand, type DynamoDBDocumentClient, type QueryCommandOutput } from "@aws-sdk/lib-dynamodb";
import { ExternalServiceError } from "../domain/errors.js";
import type { SnapCounter } from "../ports/SnapCounter.js";

interface CountQuery {
  readonly index: "by-device" | "by-user";
  readonly keyName: "device_token" | "user_id";
  readonly keyValue: string;
  readonly since: string;
}

type StartKey = Record<string, unknown> | undefined;

// Counts reports rows on the by-device and by-user GSIs over received_at, paging until the end.
export class DynamoSnapCounter implements SnapCounter {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.#client = client;
    this.#table = table;
  }

  byDevice(deviceToken: string, since: string): Promise<number> {
    return this.#count({ index: "by-device", keyName: "device_token", keyValue: deviceToken, since });
  }

  byUser(userId: string, since: string): Promise<number> {
    return this.#count({ index: "by-user", keyName: "user_id", keyValue: userId, since });
  }

  async #count(query: CountQuery): Promise<number> {
    let total = 0;
    let start: StartKey;
    do {
      const page = await this.#page(query, start);
      total += page.Count ?? 0;
      start = page.LastEvaluatedKey;
    } while (start !== undefined);
    return total;
  }

  async #page(query: CountQuery, start: StartKey): Promise<QueryCommandOutput> {
    const command = new QueryCommand({
      TableName: this.#table,
      IndexName: query.index,
      KeyConditionExpression: "#key = :key AND received_at > :since",
      FilterExpression: "capture_mode = :snap",
      ExpressionAttributeNames: { "#key": query.keyName },
      ExpressionAttributeValues: { ":key": query.keyValue, ":since": query.since, ":snap": "snap" },
      Select: "COUNT",
      ExclusiveStartKey: start,
    });
    try {
      return await this.#client.send(command);
    } catch (error) {
      throw new ExternalServiceError(`Could not count recent photos on ${query.index}`, { cause: error });
    }
  }
}
