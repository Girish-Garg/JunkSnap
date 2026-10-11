import { describe, expect, it } from "vitest";
import { ExternalServiceError } from "../../src/domain/errors.js";
import { RateLimitedError } from "../../src/domain/letters/errors.js";
import { LetterRateLimiter } from "../../src/services/letters/LetterRateLimiter.js";
import { MemoryCounter, RecordingLogger } from "./support.js";

// Looks free on the early check, then another request fills it before this one records.
class RacedCounter extends MemoryCounter {
  override async take(): Promise<boolean> {
    return false;
  }
}

// DynamoDB fails on the write after the early check passed.
class FailingCounter extends MemoryCounter {
  override async take(): Promise<boolean> {
    throw new ExternalServiceError("ProvisionedThroughputExceeded");
  }
}

// Takes like a MemoryCounter but cannot give a slot back.
class StuckCounter extends MemoryCounter {
  override async release(): Promise<void> {
    throw new ExternalServiceError("timed out");
  }
}

const requester = { deviceToken: "device-1", userId: "user-1" };
const now = new Date("2026-10-10T08:00:00Z");

describe("LetterRateLimiter", () => {
  it("takes one slot from the device and one from the user", async () => {
    const counters = { devices: new MemoryCounter(), users: new MemoryCounter() };
    await new LetterRateLimiter(counters, new RecordingLogger(), 2).take(requester, now);
    expect([counters.devices.taken, counters.users.taken]).toEqual([["device-1"], ["user-1"]]);
  });

  it("gives the device slot back when the user counter fills meanwhile, so the refusal uses up nothing", async () => {
    const counters = { devices: new MemoryCounter(), users: new RacedCounter() };
    const limiter = new LetterRateLimiter(counters, new RecordingLogger(), 2, "photo reports");
    for (const userId of ["user-1", "user-2", "user-3"]) {
      await expect(limiter.take({ ...requester, userId }, now)).rejects.toThrow(RateLimitedError);
    }
    expect(counters.devices.taken).toEqual([]);
    expect(await counters.devices.fits({ key: "device-1", now, limit: 2, windowMs: 3_600_000 })).toBe(true);
  });

  it("gives the device slot back and rethrows when the user counter fails", async () => {
    const counters = { devices: new MemoryCounter(), users: new FailingCounter() };
    const limiter = new LetterRateLimiter(counters, new RecordingLogger(), 2);
    await expect(limiter.take(requester, now)).rejects.toThrow(ExternalServiceError);
    expect(counters.devices.taken).toEqual([]);
  });

  it("still refuses with 429, and logs, when the slot cannot be given back", async () => {
    const logger = new RecordingLogger();
    const counters = { devices: new StuckCounter(), users: new RacedCounter() };
    const limiter = new LetterRateLimiter(counters, logger, 2);
    await expect(limiter.take(requester, now)).rejects.toThrow(RateLimitedError);
    expect(logger.warnings).toEqual(["could not give back a rate-limit slot"]);
  });
});
