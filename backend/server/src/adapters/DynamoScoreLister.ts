import { QueryCommand, type DynamoDBDocumentClient, type QueryCommandOutput } from "@aws-sdk/lib-dynamodb";
import type { WardScores } from "../contracts/index.gen.js";
import type { AreaKind } from "../domain/AreaKey.js";
import { ExternalServiceError } from "../domain/errors.js";
import type { ScoreLister } from "../ports/ScoreLister.js";
import { ScoreItem } from "./ScoreItem.js";

type StartKey = QueryCommandOutput["LastEvaluatedKey"];

// One Query on the area_kind partition, filtered on the `within` list, read to the last page.
export class DynamoScoreLister implements ScoreLister {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.#client = client;
    this.#table = table;
  }

  async listWithin(kind: AreaKind, within: string): Promise<WardScores[]> {
    const rows: WardScores[] = [];
    let start: StartKey = undefined;
    do {
      const page = await this.#page(kind, within, start);
      rows.push(...(page.Items ?? []).map((item) => ScoreItem.read(item).body()));
      start = page.LastEvaluatedKey;
    } while (start !== undefined);
    return rows;
  }

  async #page(kind: AreaKind, within: string, start: StartKey): Promise<QueryCommandOutput> {
    const command = new QueryCommand({
      TableName: this.#table,
      KeyConditionExpression: "area_kind = :kind",
      FilterExpression: "contains(#within, :within)",
      ExpressionAttributeNames: { "#within": "within" },
      ExpressionAttributeValues: { ":kind": kind, ":within": within },
      ExclusiveStartKey: start,
    });
    try {
      return await this.#client.send(command);
    } catch (error) {
      throw new ExternalServiceError("DynamoDB query on the scores table failed", { cause: error });
    }
  }
}
