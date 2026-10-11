import { QueryCommand, type DynamoDBDocumentClient, type QueryCommandOutput } from "@aws-sdk/lib-dynamodb";
import type { WardScores } from "../contracts/index.gen.js";
import type { AreaKind } from "../domain/AreaKey.js";
import { ExternalServiceError, InternalDataError } from "../domain/errors.js";
import type { Logger } from "../ports/Logger.js";
import type { ScoreLister } from "../ports/ScoreLister.js";
import { ScoreItem } from "./ScoreItem.js";

type StartKey = QueryCommandOutput["LastEvaluatedKey"];

// One Query on the area_kind partition, filtered on the `within` list, read to the last page.
export class DynamoScoreLister implements ScoreLister {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;
  readonly #logger: Logger;

  constructor(client: DynamoDBDocumentClient, table: string, logger: Logger) {
    this.#client = client;
    this.#table = table;
    this.#logger = logger;
  }

  async listWithin(kind: AreaKind, within: string): Promise<WardScores[]> {
    const rows: WardScores[] = [];
    let start: StartKey = undefined;
    do {
      const page = await this.#page(kind, within, start);
      rows.push(...(page.Items ?? []).flatMap((item) => this.#body(item)));
      start = page.LastEvaluatedKey;
    } while (start !== undefined);
    return rows;
  }

  // A row that breaks the contract is skipped with a warning, so one bad row cannot fail the whole list.
  #body(item: Record<string, unknown>): WardScores[] {
    try {
      return [ScoreItem.read(item).body()];
    } catch (error) {
      if (!(error instanceof InternalDataError)) {
        throw error;
      }
      this.#logger.warn({ error, area_kind: String(item.area_kind), area_id: String(item.area_id) }, "skipped a malformed scores row");
      return [];
    }
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
