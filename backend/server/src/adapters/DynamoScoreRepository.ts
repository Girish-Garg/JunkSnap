import { GetCommand, PutCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { WardScores } from "../contracts/index.gen.js";
import type { ComputedAreaScores } from "../domain/AreaInsights.js";
import type { AreaKey } from "../domain/AreaKey.js";
import { ExternalServiceError } from "../domain/errors.js";
import type { ScoreRepository } from "../ports/ScoreRepository.js";
import { ScoreItem } from "./ScoreItem.js";

// One item per area: the ward_scores body plus the area_kind and area_id keys and the `within` ids.
export class DynamoScoreRepository implements ScoreRepository {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.#client = client;
    this.#table = table;
  }

  async save(row: ComputedAreaScores, within: readonly string[]): Promise<void> {
    const item = ScoreItem.of(row, within).item();
    await this.#send(() => this.#client.send(new PutCommand({ TableName: this.#table, Item: item })));
  }

  async find(area: AreaKey): Promise<WardScores | null> {
    const key = { area_kind: area.kind, area_id: area.id };
    const output = await this.#send(() => this.#client.send(new GetCommand({ TableName: this.#table, Key: key })));
    return output.Item === undefined ? null : ScoreItem.read(output.Item).body();
  }

  async #send<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      throw new ExternalServiceError("DynamoDB call on the scores table failed", { cause: error });
    }
  }
}
