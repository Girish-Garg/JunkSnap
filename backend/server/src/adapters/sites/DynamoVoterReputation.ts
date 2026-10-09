import { GetCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Voter } from "../../domain/sites/SiteTypes.js";
import type { VoterReputation } from "../../ports/sites/VoterReputation.js";
import type { AwsCalls } from "./AwsCalls.js";

const NEW_REPUTATION = 0.5;

export interface ReputationTables {
  readonly devices: string;
  readonly users: string;
}

// Reads the devices and users tables; the weight uses the lower of the two (contracts/README.md).
export class DynamoVoterReputation implements VoterReputation {
  readonly #client: DynamoDBDocumentClient;
  readonly #tables: ReputationTables;
  readonly #calls: AwsCalls;

  constructor(client: DynamoDBDocumentClient, tables: ReputationTables, calls: AwsCalls) {
    this.#client = client;
    this.#tables = tables;
    this.#calls = calls;
  }

  async reputationOf(voter: Voter): Promise<number> {
    const [device, user] = await Promise.all([
      this.#read(this.#tables.devices, { device_token: voter.deviceToken }),
      voter.userId === null ? NEW_REPUTATION : this.#read(this.#tables.users, { user_id: voter.userId }),
    ]);
    return Math.min(device, user);
  }

  async #read(table: string, key: Record<string, string>): Promise<number> {
    const request = new GetCommand({ TableName: table, Key: key, ProjectionExpression: "reputation" });
    const { Item } = await this.#calls.run("DynamoDB get reputation", () => this.#client.send(request));
    const reputation: unknown = Item?.reputation;
    const known = typeof reputation === "number" && reputation >= 0 && reputation <= 1;
    return known ? reputation : NEW_REPUTATION;
  }
}
