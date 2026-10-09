import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { FileAssetReader } from "../../src/adapters/FileAssetReader.js";
import { LocationAssetLoader } from "../../src/adapters/location/LocationAssetLoader.js";
import { GeoPoint } from "../../src/domain/location/GeoPoint.js";
import { SeatResolver } from "../../src/services/location/SeatResolver.js";
import { CHURU_SLIVER, DELHI, JAIPUR_SLIVER, KATHMANDU, LEH, SAMPLES, SANGARIA_OVERLAP } from "./samples.js";

const REPO_DATA = fileURLToPath(new URL("../../../../data/", import.meta.url));

function ids(resolver: SeatResolver, at: { readonly lat: number; readonly lon: number }) {
  const match = resolver.resolve(GeoPoint.of(at.lat, at.lon));
  return match === null ? null : [match.assembly?.id ?? null, match.lokSabha.id, match.lokSabha.status];
}

// The committed data/ files; no network.
describe("seat resolution on the real boundary files", () => {
  let resolver: SeatResolver;

  beforeAll(async () => {
    const seats = await new LocationAssetLoader(new FileAssetReader(REPO_DATA)).loadSeats();
    resolver = new SeatResolver(seats);
  });

  it.each(SAMPLES)("puts $sample in $assembly and $loksabha", (sample) => {
    expect(ids(resolver, sample)).toEqual([sample.assembly, sample.loksabha, "current"]);
  });

  it("finds New Delhi with no assembly seat, Ladakh outdated, and nothing in Kathmandu", () => {
    expect(ids(resolver, DELHI)).toEqual([null, "u05-pc-4", "current"]);
    expect(ids(resolver, LEH)).toEqual([null, "u09-pc-1", "outdated"]);
    expect(ids(resolver, KATHMANDU)).toBeNull();
  });

  it("closes slivers between seats with the nearest seat within 1 km", () => {
    expect(ids(resolver, JAIPUR_SLIVER)).toEqual(["s20-ac-50", "s20-pc-7", "current"]);
    expect(ids(resolver, CHURU_SLIVER)).toEqual(["s20-ac-24", "s20-pc-3", "current"]);
  });

  it("gives Sangaria Ganganagar, not the Punjab seat whose shape overlaps it", () => {
    expect(ids(resolver, SANGARIA_OVERLAP)).toEqual(["s20-ac-7", "s20-pc-1", "current"]);
  });
});
