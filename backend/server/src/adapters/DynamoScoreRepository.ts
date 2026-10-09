import { GetCommand, PutCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { validateWardScores, type WardScores } from "../contracts/index.gen.js";
import type { ComputedAreaScores } from "../domain/AreaInsights.js";
import type { AreaKey } from "../domain/AreaKey.js";
import { ExternalServiceError, InternalDataError } from "../domain/errors.js";
import type { ScoreRepository } from "../ports/ScoreRepository.js";

const TABLE_KEYS = new Set(["area_kind", "area_id"]);

// One item per area: the ward_scores body plus the area_kind and area_id keys; every row passes the contract both ways.
export class DynamoScoreRepository implements ScoreRepository {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.#client = client;
    this.#table = table;
  }

  async save(row: ComputedAreaScores): Promise<void> {
    const scores = DynamoScoreRepository.#checked(row);
    const item = { area_kind: scores.area.kind, area_id: scores.area.id, ...scores };
    await this.#send(() => this.#client.send(new PutCommand({ TableName: this.#table, Item: item })));
  }

  async find(area: AreaKey): Promise<WardScores | null> {
    const key = { area_kind: area.kind, area_id: area.id };
    const output = await this.#send(() => this.#client.send(new GetCommand({ TableName: this.#table, Key: key })));
    if (output.Item === undefined) {
      return null;
    }
    const body = Object.fromEntries(Object.entries(output.Item).filter(([field]) => !TABLE_KEYS.has(field)));
    return DynamoScoreRepository.#checked(body);
  }

  async #send<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      throw new ExternalServiceError("DynamoDB call on the scores table failed", { cause: error });
    }
  }

  static #checked(row: object): WardScores {
    try {
      return validateWardScores(row);
    } catch (error) {
      throw new InternalDataError("scores row breaks the ward_scores contract", { cause: error });
    }
  }
}
