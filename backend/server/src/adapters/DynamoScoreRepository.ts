import { GetCommand, PutCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { validateWardScores, type WardScores } from "../contracts/index.gen.js";
import type { AreaInsights, AreaScoresRow } from "../domain/AreaInsights.js";
import type { AreaKey } from "../domain/AreaKey.js";
import { ExternalServiceError, InternalDataError } from "../domain/errors.js";
import type { ScoreRepository } from "../ports/ScoreRepository.js";

const NOT_IN_CONTRACT_YET = new Set(["area_kind", "area_id", "insights"]);

// One item per area: the ward_scores body plus the area_kind and area_id keys.
export class DynamoScoreRepository implements ScoreRepository {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.#client = client;
    this.#table = table;
  }

  async save(row: AreaScoresRow): Promise<void> {
    DynamoScoreRepository.#checked(row);
    const item = { area_kind: row.area.kind, area_id: row.area.id, ...row };
    await this.#send(() => this.#client.send(new PutCommand({ TableName: this.#table, Item: item })));
  }

  async find(area: AreaKey): Promise<AreaScoresRow | null> {
    const key = { area_kind: area.kind, area_id: area.id };
    const output = await this.#send(() => this.#client.send(new GetCommand({ TableName: this.#table, Key: key })));
    if (output.Item === undefined) {
      return null;
    }
    const scores = DynamoScoreRepository.#checked(output.Item);
    const insights: unknown = output.Item.insights;
    // Checked by the generated validator once ward_scores has insights (contracts v1.1, PR #25).
    return insights === undefined ? scores : { ...scores, insights: insights as AreaInsights };
  }

  async #send<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      throw new ExternalServiceError("DynamoDB call on the scores table failed", { cause: error });
    }
  }

  static #checked(row: object): WardScores {
    const scores = Object.fromEntries(Object.entries(row).filter(([field]) => !NOT_IN_CONTRACT_YET.has(field)));
    try {
      return validateWardScores(scores);
    } catch (error) {
      throw new InternalDataError("scores row breaks the ward_scores contract", { cause: error });
    }
  }
}
