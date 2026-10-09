import { PutCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { WardScores } from "../../contracts/index.gen.js";
import type { AreaScoreSeeder } from "../../ports/sites/AreaScoreSeeder.js";
import { conditionalWrite } from "./utils.js";

// Scores item: key (area_kind, area_id) plus the ward_scores fields top-level.
export class DynamoAreaScoreSeeder implements AreaScoreSeeder {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.#client = client;
    this.#table = table;
  }

  async seedIfMissing(row: WardScores): Promise<void> {
    const request = new PutCommand({
      TableName: this.#table,
      Item: { area_kind: row.area.kind, area_id: row.area.id, ...row },
      ConditionExpression: "attribute_not_exists(area_kind)",
    });
    await conditionalWrite("DynamoDB seed scores", () => this.#client.send(request));
  }
}
