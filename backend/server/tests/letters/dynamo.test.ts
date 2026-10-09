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
    const count = Number(stored.letter_count ?? 0);
    if (UpdateExpression.startsWith("SET letter_window_start")) {
      FakeCounterTable.#require(start === undefined || start === values[":seen"]);
      return { ...stored, letter_window_start: values[":now"], letter_count: values[":one"] };
    }
    FakeCounterTable.#require(start === values[":seen"] && count < Number(values[":limit"]));
    return { ...stored, letter_count: count + Number(values[":one"]) };
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
    const counter = new DynamoLetterCounter(table, devices);
    expect(await counter.take(at(0))).toBe(true);
    expect(await counter.take(at(10))).toBe(true);
    expect(await counter.fits(at(20))).toBe(false);
    expect(await counter.take(at(20))).toBe(false);
    expect(table.items.get("device-1")).toEqual({ letter_window_start: "2026-10-10T08:00:00.000Z", letter_count: 2 });
    expect(new Set(table.keys)).toEqual(new Set(["device_token"]));
  });

  it("starts a new window once an hour has passed since letter_window_start", async () => {
    const table = new FakeCounterTable();
    const counter = new DynamoLetterCounter(table, devices);
    await counter.take(at(0));
    await counter.take(at(59));
    expect(await counter.fits(at(60))).toBe(true);
    expect(await counter.take(at(60))).toBe(true);
    expect(table.items.get("device-1")).toEqual({ letter_window_start: "2026-10-10T09:00:00.000Z", letter_count: 1 });
  });

  it("keys users rows by user_id", async () => {
    const table = new FakeCounterTable();
    await new DynamoLetterCounter(table, { name: "junksnap-dev-users", keyName: "user_id" }).take(at(0));
    expect(new Set(table.keys)).toEqual(new Set(["user_id"]));
  });

  it("re-reads and retries when another request wrote in between", async () => {
    const table = new FakeCounterTable();
    const counter = new DynamoLetterCounter(table, devices);
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

  it("raises ExternalServiceError when DynamoDB fails", async () => {
    const failing = new FakeCounterTable();
    failing.beforeWrite = () => {
      throw new Error("ProvisionedThroughputExceeded");
    };
    await expect(new DynamoLetterCounter(failing, devices).take(at(0))).rejects.toThrow(ExternalServiceError);
  });
});
