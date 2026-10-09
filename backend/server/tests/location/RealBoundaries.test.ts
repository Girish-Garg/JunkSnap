import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { FileAssetReader } from "../../src/adapters/FileAssetReader.js";
import { LocationAssetLoader } from "../../src/adapters/location/LocationAssetLoader.js";
import { GeoPoint } from "../../src/domain/location/GeoPoint.js";
import { Place, type PlaceFields } from "../../src/domain/location/Place.js";
import { SeatResolver } from "../../src/services/location/SeatResolver.js";
import { CHURU_SLIVER, DELHI, JAIPUR_SLIVER, KATHMANDU, LEH, PLACES, SAMPLES, SANGARIA_OVERLAP } from "./samples.js";

const REPO_DATA = fileURLToPath(new URL("../../../../data/", import.meta.url));
const SRINAGAR = { lat: 34.0837, lon: 74.7973 } as const;

// The committed data/ files with the state Amazon Location gives for each point; no network.
describe("seat resolution on the real boundary files", () => {
  let resolver: SeatResolver;

  function ids(at: { readonly lat: number; readonly lon: number }, place: PlaceFields) {
    const match = resolver.nearby(GeoPoint.of(at.lat, at.lon))?.forPlace(new Place(place));
    return match === undefined ? null : [match.assembly?.id ?? null, match.lokSabha.id, match.lokSabha.status];
  }

  beforeAll(async () => {
    resolver = new SeatResolver(await new LocationAssetLoader(new FileAssetReader(REPO_DATA)).loadSeats());
  });

  it.each(SAMPLES)("puts $sample in $assembly and $loksabha", (sample) => {
    expect(ids(sample, sample.place)).toEqual([sample.assembly, sample.loksabha, "current"]);
  });

  it("finds New Delhi with no assembly seat, Ladakh and Srinagar outdated, and nothing in Kathmandu", () => {
    expect(ids(DELHI, PLACES.delhi)).toEqual([null, "u05-pc-4", "current"]);
    expect(ids(LEH, PLACES.leh)).toEqual([null, "u09-pc-1", "outdated"]);
    expect(ids(SRINAGAR, { ...PLACES.leh, state: "Jammu & Kashmir" })).toEqual([null, "u08-pc-2", "outdated"]);
    expect(ids(KATHMANDU, PLACES.kathmandu)).toBeNull();
  });

  it("closes slivers between seats with the nearest seat within 1 km", () => {
    expect(ids(JAIPUR_SLIVER, PLACES.jaipur)).toEqual(["s20-ac-50", "s20-pc-7", "current"]);
    expect(ids(CHURU_SLIVER, PLACES.jodhpur)).toEqual(["s20-ac-24", "s20-pc-3", "current"]);
  });

  it("follows the geocoder's state where Rajasthan's Sangaria and Punjab's Firozepur overlap", () => {
    expect(ids(SANGARIA_OVERLAP, PLACES.abohar)).toEqual([null, "s19-pc-10", "current"]);
    expect(ids(SANGARIA_OVERLAP, PLACES.sangaria)).toEqual(["s20-ac-7", "s20-pc-1", "current"]);
  });
});
