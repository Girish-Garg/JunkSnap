import { GetCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ExternalServiceError, InternalDataError } from "../domain/errors.js";
import type { ReputationReader } from "../ports/ReputationReader.js";

const NEW_REPUTATION = 0.5;

export interface ReputationTables {
  readonly devices: string;
  readonly users: string;
}

export class DynamoReputationReader implements ReputationReader {
  readonly #client: DynamoDBDocumentClient;
  readonly #tables: ReputationTables;

  constructor(client: DynamoDBDocumentClient, tables: ReputationTables) {
    this.#client = client;
    this.#tables = tables;
  }

  ofDevice(deviceToken: string): Promise<number> {
    return this.#read(this.#tables.devices, { device_token: deviceToken });
  }

  ofUser(userId: string): Promise<number> {
    return this.#read(this.#tables.users, { user_id: userId });
  }

  async #read(table: string, key: Record<string, string>): Promise<number> {
    const names = { "#reputation": "reputation" };
    const command = new GetCommand({ TableName: table, Key: key, ProjectionExpression: "#reputation", ExpressionAttributeNames: names });
    let item: Record<string, unknown> | undefined;
    try {
      item = (await this.#client.send(command)).Item;
    } catch (error) {
      throw new ExternalServiceError(`Could not read a reputation from ${table}`, { cause: error });
    }
    const reputation = item?.reputation ?? NEW_REPUTATION;
    if (typeof reputation !== "number" || reputation < 0 || reputation > 1) {
      throw new InternalDataError(`${table} holds a reputation outside 0 to 1`);
    }
    return reputation;
  }
}
