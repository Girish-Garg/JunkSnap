import type { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it } from "vitest";
import { DynamoUserStanding } from "../../src/adapters/DynamoUserStanding.js";
import { ExternalServiceError } from "../../src/domain/errors.js";
import type { Clock } from "../../src/ports/Clock.js";
import { CachedUserStanding } from "../../src/services/CachedUserStanding.js";
import { FakeUserStanding } from "./FakeUserStanding.js";

const USER = "6b1d3c9e-2f4a-4e8b-9c7d-1a2b3c4d5e6f";

// Answers each GetItem with the next scripted output and records the commands.
class ScriptedUsers {
  readonly commands: GetCommand[] = [];
  readonly #outputs: (object | Error)[];

  constructor(outputs: (object | Error)[]) {
    this.#outputs = outputs;
  }

  async send(command: GetCommand): Promise<object> {
    this.commands.push(command);
    const next = this.#outputs.shift() ?? {};
    return next instanceof Error ? Promise.reject(next) : next;
  }

  standing(): DynamoUserStanding {
    return new DynamoUserStanding(this as unknown as DynamoDBDocumentClient, "junksnap-dev-users");
  }
}

class StepClock implements Clock {
  #ms = Date.parse("2026-10-11T04:00:00Z");

  now(): Date {
    return new Date(this.#ms);
  }

  advance(ms: number): void {
    this.#ms += ms;
  }
}

describe("DynamoUserStanding", () => {
  it("reads only the blocked attribute of the user's row", async () => {
    const users = new ScriptedUsers([{ Item: { blocked: true } }]);
    expect(await users.standing().isBlocked(USER)).toBe(true);
    expect(users.commands[0]?.input).toEqual({
      TableName: "junksnap-dev-users",
      Key: { user_id: USER },
      ProjectionExpression: "#blocked",
      ExpressionAttributeNames: { "#blocked": "blocked" },
    });
  });

  it.each([
    ["a missing row", {}],
    ["a row without blocked", { Item: {} }],
    ["blocked false", { Item: { blocked: false } }],
  ])("is not blocked for %s", async (_case, output) => {
    expect(await new ScriptedUsers([output]).standing().isBlocked(USER)).toBe(false);
  });

  it("turns a DynamoDB error into ExternalServiceError", async () => {
    await expect(new ScriptedUsers([new Error("throttled")]).standing().isBlocked(USER)).rejects.toThrow(ExternalServiceError);
  });
});

describe("CachedUserStanding", () => {
  it("reuses an answer within the window and reads again after it", async () => {
    const inner = new FakeUserStanding([USER]);
    const clock = new StepClock();
    const cached = new CachedUserStanding(inner, clock, 60_000);
    expect(await cached.isBlocked(USER)).toBe(true);
    clock.advance(59_000);
    expect(await cached.isBlocked(USER)).toBe(true);
    expect(inner.reads).toHaveLength(1);
    clock.advance(1_000);
    await cached.isBlocked(USER);
    expect(inner.reads).toHaveLength(2);
  });

  it("keeps each user's answer apart", async () => {
    const cached = new CachedUserStanding(new FakeUserStanding([USER]), new StepClock(), 60_000);
    expect(await cached.isBlocked(USER)).toBe(true);
    expect(await cached.isBlocked("someone-else")).toBe(false);
  });
});
