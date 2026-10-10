import {
  GetCommand,
  UpdateCommand,
  type GetCommandOutput,
  type UpdateCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { ExternalServiceError } from "../../domain/errors.js";
import type { CountRequest, LetterCounter } from "../../ports/letters/LetterCounter.js";

const ATTEMPTS = 3;
const CONDITION_FAILED = "ConditionalCheckFailedException";

export interface CounterClient {
  send(command: GetCommand): Promise<GetCommandOutput>;
  send(command: UpdateCommand): Promise<UpdateCommandOutput>;
}

export interface CounterTable {
  readonly name: string;
  // devices rows use device_token, users rows use user_id.
  readonly keyName: string;
  // Attribute prefix: letter (letter_window_start, letter_count), note or withdraw.
  readonly prefix?: "letter" | "note" | "withdraw";
}

interface Window {
  // ISO time as stored, or null before the first letter.
  readonly start: string | null;
  readonly count: number;
}

// Windowed counter from contracts/README.md: reset once windowMs has passed since letter_window_start.
export class DynamoLetterCounter implements LetterCounter {
  readonly #client: CounterClient;
  readonly #table: CounterTable;
  readonly #start: string;
  readonly #count: string;

  constructor(client: CounterClient, table: CounterTable) {
    this.#client = client;
    this.#table = table;
    this.#start = `${table.prefix ?? "letter"}_window_start`;
    this.#count = `${table.prefix ?? "letter"}_count`;
  }

  async fits(request: CountRequest): Promise<boolean> {
    const window = await this.#read(request.key);
    return DynamoLetterCounter.#expired(window, request) || window.count < request.limit;
  }

  async take(request: CountRequest): Promise<boolean> {
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      const window = await this.#read(request.key);
      const expired = DynamoLetterCounter.#expired(window, request);
      if (!expired && window.count >= request.limit) {
        return false;
      }
      const command = expired ? this.#restart(request, window) : this.#increment(request, window);
      if (await this.#write(command)) {
        return true;
      }
    }
    throw new ExternalServiceError(`Letter counter in ${this.#table.name} kept changing during ${ATTEMPTS} attempts`);
  }

  async #read(key: string): Promise<Window> {
    const command = new GetCommand({
      TableName: this.#table.name,
      Key: { [this.#table.keyName]: key },
      ProjectionExpression: `${this.#start}, ${this.#count}`,
      ConsistentRead: true,
    });
    const item = (await this.#call(() => this.#client.send(command))).Item ?? {};
    const [start, count] = [item[this.#start], item[this.#count]];
    return { start: typeof start === "string" ? start : null, count: typeof count === "number" ? count : 0 };
  }

  #restart(request: CountRequest, window: Window): UpdateCommand {
    return new UpdateCommand({
      TableName: this.#table.name,
      Key: { [this.#table.keyName]: request.key },
      UpdateExpression: `SET ${this.#start} = :now, ${this.#count} = :one`,
      ConditionExpression: `attribute_not_exists(${this.#start}) OR ${this.#start} = :seen`,
      ExpressionAttributeValues: { ":now": request.now.toISOString(), ":one": 1, ":seen": window.start ?? "" },
    });
  }

  #increment(request: CountRequest, window: Window): UpdateCommand {
    return new UpdateCommand({
      TableName: this.#table.name,
      Key: { [this.#table.keyName]: request.key },
      UpdateExpression: `SET ${this.#count} = ${this.#count} + :one`,
      ConditionExpression: `${this.#start} = :seen AND ${this.#count} < :limit`,
      ExpressionAttributeValues: { ":one": 1, ":seen": window.start, ":limit": request.limit },
    });
  }

  async #write(command: UpdateCommand): Promise<boolean> {
    try {
      await this.#client.send(command);
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === CONDITION_FAILED) {
        return false;
      }
      throw new ExternalServiceError(`Could not record a letter in ${this.#table.name}`, { cause: error });
    }
  }

  async #call<T>(send: () => Promise<T>): Promise<T> {
    try {
      return await send();
    } catch (error) {
      throw new ExternalServiceError(`Could not read the letter counter from ${this.#table.name}`, { cause: error });
    }
  }

  static #expired(window: Window, request: CountRequest): boolean {
    return window.start === null || request.now.getTime() - Date.parse(window.start) >= request.windowMs;
  }
}
