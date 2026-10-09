import { beforeAll, describe, expect, it } from "vitest";
import { FileAssetReader } from "../../src/adapters/FileAssetReader.js";
import { LocationAssetLoader } from "../../src/adapters/location/LocationAssetLoader.js";
import { GeoPoint } from "../../src/domain/location/GeoPoint.js";
import type { SeatLocator } from "../../src/ports/location/SeatLocator.js";
import { AssetSettings } from "../../src/settings/AssetSettings.js";
import { DELHI, KATHMANDU, LEH, SAMPLES } from "./samples.js";

// The committed data/ files, through the default ASSETS_DIR; no network.
describe("seat lookup on the real boundary files", () => {
  let seats: SeatLocator;

  beforeAll(async () => {
    const reader = new FileAssetReader(AssetSettings.fromEnv({}).assetsDir);
    seats = await new LocationAssetLoader(reader).loadSeats();
  });

  it.each(SAMPLES)("puts $sample in $assembly and $loksabha", ({ lat, lon, assembly, loksabha }) => {
    const point = GeoPoint.of(lat, lon);
    expect(seats.assemblySeatAt(point)?.id).toBe(assembly);
    expect(seats.lokSabhaSeatAt(point)).toMatchObject({ id: loksabha, status: "current" });
  });

  it("finds New Delhi with no assembly seat, Ladakh outdated, and nothing in Kathmandu", () => {
    expect(seats.assemblySeatAt(GeoPoint.of(DELHI.lat, DELHI.lon))).toBeNull();
    expect(seats.lokSabhaSeatAt(GeoPoint.of(DELHI.lat, DELHI.lon))).toMatchObject({ id: "u05-pc-4" });
    expect(seats.lokSabhaSeatAt(GeoPoint.of(LEH.lat, LEH.lon))).toMatchObject({ id: "u09-pc-1", status: "outdated" });
    expect(seats.lokSabhaSeatAt(GeoPoint.of(KATHMANDU.lat, KATHMANDU.lon))).toBeNull();
  });
});
