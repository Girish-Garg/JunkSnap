import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { FileAssetReader } from "../src/adapters/FileAssetReader.js";
import { ConfigError, InternalDataError } from "../src/domain/errors.js";
import { AssetSettings } from "../src/settings/AssetSettings.js";

describe("AssetSettings", () => {
  it("defaults to the repo's data folder, two levels above backend/server", () => {
    const server = resolve("/repo/backend/server");
    expect(AssetSettings.fromEnv({}, server).assetsDir).toBe(resolve("/repo/data"));
  });

  it("takes ASSETS_DIR, relative to the working directory", () => {
    expect(AssetSettings.fromEnv({ ASSETS_DIR: "/app/assets" }, "/x").assetsDir).toBe(resolve("/app/assets"));
    expect(AssetSettings.fromEnv({ ASSETS_DIR: "assets" }, resolve("/app")).assetsDir).toBe(resolve("/app/assets"));
  });
});

describe("FileAssetReader", () => {
  const root = mkdtempSync(join(tmpdir(), "server-18-location-assets-test-"));
  writeFileSync(join(root, "bom.json"), "﻿{\"ok\": true}");
  writeFileSync(join(root, "broken.json"), "{");
  const reader = new FileAssetReader(root);

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("reads JSON, dropping a UTF-8 byte order mark", async () => {
    expect(await reader.readJson("bom.json")).toEqual({ ok: true });
  });

  it("returns the exact bytes, for hashing", async () => {
    expect(Array.from((await reader.readBytes("bom.json")).slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("names the fix when a file is missing", async () => {
    await expect(reader.readText("boundaries/none.geojson")).rejects.toThrow(ConfigError);
    await expect(reader.readText("boundaries/none.geojson")).rejects.toThrow(/npm run assets/);
  });

  it("rejects broken JSON and paths that leave the assets folder", async () => {
    await expect(reader.readJson("broken.json")).rejects.toThrow(InternalDataError);
    await expect(reader.readText("../outside.json")).rejects.toThrow(/not a file under the assets folder/);
    await expect(reader.readText(".")).rejects.toThrow(InternalDataError);
  });
});
