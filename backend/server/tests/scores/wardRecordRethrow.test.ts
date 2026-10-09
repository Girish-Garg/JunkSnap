import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { WardRecordAreaFacts } from "../../src/adapters/WardRecordAreaFacts.js";
import type * as Contracts from "../../src/contracts/index.gen.js";

// Makes the ward_record validator fail with a plain TypeError, as a validator bug would.
vi.mock("../../src/contracts/index.gen.js", async (importOriginal) => {
  const original = await importOriginal<typeof Contracts>();
  return {
    ...original,
    validateWardRecord: () => {
      throw new TypeError("validator bug");
    },
  };
});

it("stops loading when checking a reviewed ward record fails for a reason other than the contract", async () => {
  const dir = await mkdtemp(join(tmpdir(), "server-20-scores-rethrow-"));
  await mkdir(join(dir, "wards"));
  await writeFile(join(dir, "wards", "jodhpur.json"), JSON.stringify({ records: [{ id: "x", review_status: "reviewed" }] }));
  await expect(WardRecordAreaFacts.fromDirectory(dir)).rejects.toThrow("validator bug");
  await rm(dir, { recursive: true, force: true });
});
