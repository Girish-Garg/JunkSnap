import { GetCommand, QueryCommand, type DynamoDBDocumentClient, type QueryCommandOutput } from "@aws-sdk/lib-dynamodb";
import { ExternalServiceError, InternalDataError } from "../../domain/errors.js";
import type { Sender } from "../../domain/moderation/PhotoSubmission.js";
import { isoSeconds } from "../../domain/timeUtils.js";
import type { DeviceRegistry, DeviceStanding, PhotoWindow } from "../../ports/moderation/DeviceRegistry.js";

const NEW_REPUTATION = 0.5;
const KEYS = {
  device: { attribute: "device_token", index: "by-device" },
  user: { attribute: "user_id", index: "by-user" },
} as const;

export interface DeviceTables {
  readonly reports: string;
  readonly devices: string;
  readonly users: string;
}

type StartKey = Record<string, unknown> | undefined;

// The devices and users rows, and Snap photos counted on the reports by-device and by-user GSIs.
export class DynamoDeviceRegistry implements DeviceRegistry {
  readonly #client: DynamoDBDocumentClient;
  readonly #tables: DeviceTables;

  constructor(client: DynamoDBDocumentClient, tables: DeviceTables) {
    this.#client = client;
    this.#tables = tables;
  }

  async standing(sender: Sender): Promise<DeviceStanding> {
    const table = sender.kind === "device" ? this.#tables.devices : this.#tables.users;
    const key = { [KEYS[sender.kind].attribute]: sender.id };
    const item = await this.#send(`read ${table}`, () => this.#client.send(new GetCommand({ TableName: table, Key: key })));
    const reputation = item.Item?.reputation ?? NEW_REPUTATION;
    if (typeof reputation !== "number" || reputation < 0 || reputation > 1) {
      throw new InternalDataError(`${table} holds a reputation outside 0 to 1`);
    }
    return { known: item.Item !== undefined, reputation, blocked: item.Item?.blocked === true };
  }

  // received_at is stored to the second, so the window is compared in the same format, both ends included.
  async snapPhotos(window: PhotoWindow): Promise<number> {
    let total = 0;
    let start: StartKey;
    do {
      const page = await this.#page(window, start);
      total += page.Count ?? 0;
      start = page.LastEvaluatedKey;
    } while (start !== undefined);
    return total;
  }

  #page(window: PhotoWindow, start: StartKey): Promise<QueryCommandOutput> {
    const { attribute, index } = KEYS[window.sender.kind];
    const command = new QueryCommand({
      TableName: this.#tables.reports,
      IndexName: index,
      KeyConditionExpression: "#key = :key AND received_at BETWEEN :from AND :to",
      FilterExpression: "capture_mode = :snap",
      ExpressionAttributeNames: { "#key": attribute },
      ExpressionAttributeValues: {
        ":key": window.sender.id,
        ":from": isoSeconds(window.from),
        ":to": isoSeconds(window.to),
        ":snap": "snap",
      },
      Select: "COUNT",
      ExclusiveStartKey: start,
    });
    return this.#send(`count photos on ${index}`, () => this.#client.send(command));
  }

  async #send<T>(what: string, call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      throw new ExternalServiceError(`DynamoDB ${what} failed`, { cause: error });
    }
  }
}
