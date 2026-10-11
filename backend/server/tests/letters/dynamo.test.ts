import {
  GetCommand,
  type GetCommandOutput,
  type UpdateCommand,
  type UpdateCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { describe, expect, it } from "vitest";
import { DynamoLetterCounter, type CounterClient } from "../../src/adapters/letters/DynamoLetterCounter.js";
import { DynamoSiteReader, type SiteGetter } from "../../src/adapters/letters/DynamoSiteReader.js";
import { ExternalServiceError, InternalDataError } from "../../src/domain/errors.js";
import { siteFixture } from "./support.js";
import { RETRY } from "../defaults.js";

type Item = Record<string, unknown>;

const jodhpur = siteFixture("jdh-1");
const storedSite: Item = {
  ...jodhpur.properties,
  lat: jodhpur.geometry.coordinates[1],
  lon: jodhpur.geometry.coordinates[0],
  geohash4: "tsj9",
  report_ids: ["rpt_jdh_1"],
};

class FakeSitesTable implements SiteGetter {
  readonly #items: Item[];

  constructor(items: Item[]) {
    this.#items = items;
  }

  async send(command: GetCommand): Promise<GetCommandOutput> {
    const item = this.#items.find((candidate) => candidate.site_id === command.input.Key?.site_id);
    return { $metadata: {}, Item: item };
  }
}

class ConditionFailed extends Error {
  override readonly name = "ConditionalCheckFailedException";
}

// In-memory table that evaluates the counter's two condition expressions as DynamoDB would.
class FakeCounterTable implements CounterClient {
  readonly items = new Map<string, Item>();
  readonly keys: string[] = [];
  beforeWrite: () => void = () => {};

  send(command: GetCommand): Promise<GetCommandOutput>;
  send(command: UpdateCommand): Promise<UpdateCommandOutput>;
  async send(command: GetCommand | UpdateCommand): Promise<GetCommandOutput | UpdateCommandOutput> {
    const [[keyName, key]] = Object.entries(command.input.Key ?? {}) as [[string, string]];
    this.keys.push(keyName);
    if (command instanceof GetCommand) {
      return { $metadata: {}, Item: this.items.get(key) };
    }
    this.beforeWrite();
    this.items.set(key, FakeCounterTable.#apply(command, this.items.get(key) ?? {}));
    return { $metadata: {} };
  }

  static #apply(command: UpdateCommand, stored: Item): Item {
    const { UpdateExpression = "", ConditionExpression = "", ExpressionAttributeValues: values = {} } = command.input;
    const unused = Object.keys(values).filter((name) => !`${UpdateExpression} ${ConditionExpression}`.includes(name));
    expect(unused, "DynamoDB rejects unused expression values").toEqual([]);
    const start = stored.letter_window_start;
    if (UpdateExpression.startsWith("SET letter_window_start")) {
      FakeCounterTable.#require(start === undefined || start === values[":seen"]);
      return { ...stored, letter_window_start: values[":now"], letter_count: values[":one"] };
    }
    return FakeCounterTable.#step(UpdateExpression.endsWith("- :one") ? -1 : 1, stored, values);
  }

  // +1 below :limit, or -1 (a release) above :zero, both only in the window that was read.
  static #step(sign: 1 | -1, stored: Item, values: Item): Item {
    const count = Number(stored.letter_count ?? 0);
    const room = sign === 1 ? count < Number(values[":limit"]) : count > Number(values[":zero"]);
    FakeCounterTable.#require(stored.letter_window_start === values[":seen"] && room);
    return { ...stored, letter_count: count + sign * Number(values[":one"]) };
  }

  static #require(condition: boolean): void {
    if (!condition) {
      throw new ConditionFailed("The conditional request failed");
    }
  }
}

describe("DynamoSiteReader", () => {
  it("rebuilds the site Feature from the stored item", async () => {
    const reader = new DynamoSiteReader(new FakeSitesTable([storedSite]), "junksnap-dev-sites");
    expect(await reader.find("site_jdh_1")).toEqual(jodhpur);
  });

  it("returns null for an unknown site", async () => {
    const reader = new DynamoSiteReader(new FakeSitesTable([storedSite]), "junksnap-dev-sites");
    expect(await reader.find("site_jdh_404")).toBeNull();
  });

  it("raises InternalDataError when the stored item breaks the site contract", async () => {
    const broken = { ...storedSite, location: null };
    const reader = new DynamoSiteReader(new FakeSitesTable([broken]), "junksnap-dev-sites");
    await expect(reader.find("site_jdh_1")).rejects.toThrow(InternalDataError);
  });

  it("raises ExternalServiceError when DynamoDB fails", async () => {
    const failing: SiteGetter = { send: async () => Promise.reject(new Error("AccessDenied")) };
    await expect(new DynamoSiteReader(failing, "t").find("site_jdh_1")).rejects.toThrow(ExternalServiceError);
  });
});

describe("DynamoLetterCounter", () => {
  const devices = { name: "junksnap-dev-devices", keyName: "device_token" };
  const at = (minute: number) => ({ key: "device-1", now: new Date(Date.UTC(2026, 9, 10, 8, minute)), limit: 2, windowMs: 3_600_000 });

  it("counts letters in a window that starts with the first one and refuses the one over the limit", async () => {
    const table = new FakeCounterTable();
    const counter = new DynamoLetterCounter(table, devices, RETRY.counter);
    expect(await counter.take(at(0))).toBe(true);
    expect(await counter.take(at(10))).toBe(true);
    expect(await counter.fits(at(20))).toBe(false);
    expect(await counter.take(at(20))).toBe(false);
    expect(table.items.get("device-1")).toEqual({ letter_window_start: "2026-10-10T08:00:00.000Z", letter_count: 2 });
    expect(new Set(table.keys)).toEqual(new Set(["device_token"]));
  });

  it("starts a new window once an hour has passed since letter_window_start", async () => {
    const table = new FakeCounterTable();
    const counter = new DynamoLetterCounter(table, devices, RETRY.counter);
    await counter.take(at(0));
    await counter.take(at(59));
    expect(await counter.fits(at(60))).toBe(true);
    expect(await counter.take(at(60))).toBe(true);
    expect(table.items.get("device-1")).toEqual({ letter_window_start: "2026-10-10T09:00:00.000Z", letter_count: 1 });
  });

  it("keys users rows by user_id", async () => {
    const table = new FakeCounterTable();
    await new DynamoLetterCounter(table, { name: "junksnap-dev-users", keyName: "user_id" }, RETRY.counter).take(at(0));
    expect(new Set(table.keys)).toEqual(new Set(["user_id"]));
  });

  it("re-reads and retries when another request wrote in between", async () => {
    const table = new FakeCounterTable();
    const counter = new DynamoLetterCounter(table, devices, RETRY.counter);
    await counter.take(at(0));
    let raced = false;
    table.beforeWrite = () => {
      if (!raced) {
        raced = true;
        table.items.set("device-1", { letter_window_start: "2026-10-10T08:00:00.000Z", letter_count: 2 });
      }
    };
    expect(await counter.take(at(5))).toBe(false);
    expect(table.items.get("device-1")?.letter_count).toBe(2);
  });

  it("refuses (false, so 429) instead of failing when other writers change the window on every attempt", async () => {
    const table = new FakeCounterTable();
    const counter = new DynamoLetterCounter(table, devices, RETRY.counter);
    await counter.take(at(0));
    let writes = 0;
    table.beforeWrite = () => {
      writes += 1;
      table.items.set("device-1", { letter_window_start: `2026-10-10T08:00:0${String(writes % 2)}.000Z`, letter_count: 1 });
    };
    expect(await counter.take(at(5))).toBe(false);
    expect(writes).toBe(5);
  });

  it("gives back a taken letter in the same window and leaves a restarted window alone", async () => {
    const table = new FakeCounterTable();
    const counter = new DynamoLetterCounter(table, devices, RETRY.counter);
    await counter.take(at(0));
    await counter.take(at(10));
    await counter.release(at(20));
    expect(table.items.get("device-1")).toEqual({ letter_window_start: "2026-10-10T08:00:00.000Z", letter_count: 1 });
    await counter.release(at(61));
    expect(table.items.get("device-1")?.letter_count).toBe(1);
  });

  it("leaves alone a window another request restarted after this one's time", async () => {
    const table = new FakeCounterTable();
    const counter = new DynamoLetterCounter(table, devices, RETRY.counter);
    await counter.take(at(0));
    await counter.take(at(61));
    await counter.release(at(59));
    expect(table.items.get("device-1")).toEqual({ letter_window_start: "2026-10-10T09:01:00.000Z", letter_count: 1 });
  });

  it("raises ExternalServiceError when DynamoDB fails", async () => {
    const failing = new FakeCounterTable();
    failing.beforeWrite = () => {
      throw new Error("ProvisionedThroughputExceeded");
    };
    await expect(new DynamoLetterCounter(failing, devices, RETRY.counter).take(at(0))).rejects.toThrow(ExternalServiceError);
  });
});
