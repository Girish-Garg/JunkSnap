import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateLocationLookup } from "../../src/contracts/index.gen.js";
import { ValidationError } from "../../src/domain/errors.js";
import { OutsideIndiaError } from "../../src/domain/location/OutsideIndiaError.js";
import type { PlaceFields } from "../../src/domain/location/Place.js";
import { LocationServiceFactory } from "../../src/handlers/LocationServiceFactory.js";
import { AssetSettings } from "../../src/settings/AssetSettings.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import { FakeReverseGeocoder } from "./FakeReverseGeocoder.js";
import { DELHI, KATHMANDU, LEH, PLACES, SAMPLES } from "./samples.js";

const FIXTURES = fileURLToPath(new URL("fixtures/", import.meta.url));
const MLA_SOURCE = "https://assembly.rajasthan.gov.in/";
const MP_SOURCE = "https://sansad.in/ls/members";

async function serviceWith(place: PlaceFields) {
  const geocoder = new FakeReverseGeocoder(place);
  const core = CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" });
  const factory = new LocationServiceFactory(core, AssetSettings.fromEnv({ ASSETS_DIR: FIXTURES }));
  return { service: await factory.create(geocoder), geocoder };
}

describe("LocationService.locate with fixture polygons", () => {
  it("builds the whole lookup for jdh-1, in seat 128", async () => {
    const { service } = await serviceWith(PLACES.jodhpur);
    expect(await service.locate(26.2618, 73.0035)).toEqual({
      lat: 26.2618,
      lon: 73.0035,
      state: "Rajasthan",
      district: { id: "rajasthan-jodhpur", name: "Jodhpur" },
      town: "Jodhpur",
      local_body: { id: "jodhpur-mc", name: "Jodhpur Municipal Corporation", head_office: "Commissioner" },
      ward: null,
      assembly_seat: { id: "s20-ac-128", name: "Jodhpur" },
      loksabha_seat: { id: "s20-pc-16", name: "Jodhpur", status: "current" },
      representatives: [
        { office: "mla", seat_id: "s20-ac-128", as_of: "2026-10-10", source: MLA_SOURCE },
        { office: "mp", seat_id: "s20-pc-16", as_of: "2026-10-10", source: MP_SOURCE },
      ],
      geocoder: "fake-geocoder",
      boundaries_version: "eci-2008-delimitation/v1",
      looked_up_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/),
    });
  });

  it.each(SAMPLES)("puts $sample in $assembly and $loksabha, valid against the contract", async (sample) => {
    const { service } = await serviceWith(sample.place);
    const lookup = await service.locate(sample.lat, sample.lon);
    expect(lookup.assembly_seat?.id).toBe(sample.assembly);
    expect(lookup.loksabha_seat.id).toBe(sample.loksabha);
    expect(lookup.representatives.map((row) => row.seat_id)).toEqual([sample.assembly, sample.loksabha]);
    expect(() => validateLocationLookup(lookup)).not.toThrow();
  });

  it("finds Jaipur's local body and Malviya Nagar for jpr-1", async () => {
    const { service } = await serviceWith(PLACES.jaipur);
    const lookup = await service.locate(26.853, 75.8156);
    expect(lookup.assembly_seat).toEqual({ id: "s20-ac-54", name: "Malviya Nagar" });
    expect(lookup.loksabha_seat).toEqual({ id: "s20-pc-7", name: "Jaipur", status: "current" });
    expect(lookup.local_body?.id).toBe("jaipur-mc");
    expect(lookup.district).toEqual({ id: "rajasthan-jaipur", name: "Jaipur" });
  });

  it("gives Delhi a Lok Sabha seat and MP row but no assembly seat, MLA row or local body", async () => {
    const { service } = await serviceWith(PLACES.delhi);
    const lookup = await service.locate(DELHI.lat, DELHI.lon);
    expect(lookup.assembly_seat).toBeNull();
    expect(lookup.loksabha_seat).toEqual({ id: "u05-pc-4", name: "New Delhi", status: "current" });
    expect(lookup.representatives).toEqual([
      { office: "mp", seat_id: "u05-pc-4", as_of: "2026-10-10", source: MP_SOURCE },
    ]);
    expect(lookup.local_body).toBeNull();
    expect(lookup.district).toEqual({ id: "delhi-new-delhi", name: "New Delhi" });
    expect(() => validateLocationLookup(lookup)).not.toThrow();
  });

  it("never gives an outdated Lok Sabha seat an MP row, though the row exists", async () => {
    const { service } = await serviceWith(PLACES.leh);
    const lookup = await service.locate(LEH.lat, LEH.lon);
    expect(lookup.loksabha_seat).toEqual({ id: "u09-pc-1", name: "Ladakh", status: "outdated" });
    expect(lookup.representatives).toEqual([]);
    expect(() => validateLocationLookup(lookup)).not.toThrow();
  });

  it("rejects a point outside India before calling the geocoder", async () => {
    const { service, geocoder } = await serviceWith(PLACES.kathmandu);
    await expect(service.locate(KATHMANDU.lat, KATHMANDU.lon)).rejects.toThrow(OutsideIndiaError);
    expect(geocoder.calls).toEqual([]);
  });

  it("rejects a point the geocoder places in another country", async () => {
    const { service, geocoder } = await serviceWith(PLACES.kathmandu);
    await expect(service.locate(26.2618, 73.0035)).rejects.toThrow(/in NP, not India/);
    expect(geocoder.calls).toHaveLength(1);
  });

  it("takes the nearest assembly seat across a sliver inside its own Lok Sabha seat", async () => {
    const { service } = await serviceWith(PLACES.jaipur);
    const lookup = await service.locate(26.855, 75.835);
    expect(lookup.assembly_seat?.id).toBe("s20-ac-54");
    expect(lookup.loksabha_seat.id).toBe("s20-pc-7");
  });

  it("takes the nearest Lok Sabha seat within 1 km when no polygon contains the point", async () => {
    const { service } = await serviceWith(PLACES.jaipur);
    const lookup = await service.locate(27.005, 75.85);
    expect(lookup.assembly_seat).toBeNull();
    expect(lookup.loksabha_seat.id).toBe("s20-pc-7");
    expect(lookup.representatives.map((row) => row.seat_id)).toEqual(["s20-pc-7"]);
  });

  it("rejects a point more than 1 km from every seat, before calling the geocoder", async () => {
    const { service, geocoder } = await serviceWith(PLACES.jaipur);
    await expect(service.locate(27.02, 75.85)).rejects.toThrow(OutsideIndiaError);
    expect(geocoder.calls).toEqual([]);
  });

  it("takes the Lok Sabha seat of the assembly seat where two states' shapes overlap", async () => {
    const { service } = await serviceWith(PLACES.sangaria);
    const lookup = await service.locate(29.95, 74.39);
    expect(lookup.assembly_seat).toEqual({ id: "s20-ac-7", name: "Sangaria" });
    expect(lookup.loksabha_seat).toEqual({ id: "s20-pc-1", name: "Ganganagar", status: "current" });
    expect(lookup.representatives.map((row) => row.seat_id)).toEqual(["s20-ac-7", "s20-pc-1"]);
  });

  it("never pulls a nearby assembly seat across a state border", async () => {
    const { service } = await serviceWith(PLACES.abohar);
    const lookup = await service.locate(30.005, 74.4);
    expect(lookup.assembly_seat).toBeNull();
    expect(lookup.loksabha_seat.id).toBe("s19-pc-10");
    expect(lookup.representatives.map((row) => row.office)).toEqual(["mp"]);
  });

  it("rejects coordinates outside WGS 84 as a bad request", async () => {
    const { service } = await serviceWith(PLACES.jodhpur);
    await expect(service.locate(91, 73)).rejects.toThrow(ValidationError);
    await expect(service.locate(Number.NaN, 73)).rejects.toThrow(/not a WGS 84 point/);
  });
});
