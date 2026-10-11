import { GetCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ExternalServiceError } from "../domain/errors.js";
import type { UserStanding } from "../ports/UserStanding.js";

// One GetItem on the users row, projecting only `blocked`.
export class DynamoUserStanding implements UserStanding {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.#client = client;
    this.#table = table;
  }

  async isBlocked(userId: string): Promise<boolean> {
    const command = new GetCommand({
      TableName: this.#table,
      Key: { user_id: userId },
      ProjectionExpression: "#blocked",
      ExpressionAttributeNames: { "#blocked": "blocked" },
    });
    try {
      const { Item } = await this.#client.send(command);
      return Item?.["blocked"] === true;
    } catch (error) {
      throw new ExternalServiceError(`Could not read the user's standing from ${this.#table}`, { cause: error });
    }
  }
}
