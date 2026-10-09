import { GetCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { DeviceReputation } from "../../ports/sites/DeviceReputation.js";
import { awsCall } from "./utils.js";

const NEW_DEVICE_REPUTATION = 0.5;

export class DynamoDeviceReputation implements DeviceReputation {
  readonly #client: DynamoDBDocumentClient;
  readonly #table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.#client = client;
    this.#table = table;
  }

  async reputationOf(deviceToken: string): Promise<number> {
    const request = new GetCommand({
      TableName: this.#table,
      Key: { device_token: deviceToken },
      ProjectionExpression: "reputation",
    });
    const { Item } = await awsCall("DynamoDB get device", () => this.#client.send(request));
    const reputation: unknown = Item?.reputation;
    const known = typeof reputation === "number" && reputation >= 0 && reputation <= 1;
    return known ? reputation : NEW_DEVICE_REPUTATION;
  }
}
