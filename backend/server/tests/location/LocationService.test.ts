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
      loksabha_seat: { id: "s20-pc-16", name: "Jodhpur" },
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
    expect(lookup.loksabha_seat).toEqual({ id: "s20-pc-7", name: "Jaipur" });
    expect(lookup.local_body?.id).toBe("jaipur-mc");
    expect(lookup.district).toEqual({ id: "rajasthan-jaipur", name: "Jaipur" });
  });

  it("gives Delhi a Lok Sabha seat and MP row but no assembly seat, MLA row or local body", async () => {
    const { service } = await serviceWith(PLACES.delhi);
    const lookup = await service.locate(DELHI.lat, DELHI.lon);
    expect(lookup.assembly_seat).toBeNull();
    expect(lookup.loksabha_seat).toEqual({ id: "u05-pc-4", name: "New Delhi" });
    expect(lookup.representatives).toEqual([
      { office: "mp", seat_id: "u05-pc-4", as_of: "2026-10-10", source: MP_SOURCE },
    ]);
    expect(lookup.local_body).toBeNull();
    expect(lookup.district).toEqual({ id: "delhi-new-delhi", name: "New Delhi" });
  });

  it("never gives an outdated Lok Sabha seat an MP row, though the row exists", async () => {
    const { service } = await serviceWith(PLACES.leh);
    const lookup = await service.locate(LEH.lat, LEH.lon);
    expect(lookup.loksabha_seat).toEqual({ id: "u09-pc-1", name: "Ladakh" });
    expect(lookup.representatives).toEqual([]);
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

  it("leaves the assembly seat empty in a gap inside its bounding box", async () => {
    const { service } = await serviceWith(PLACES.jodhpur);
    const lookup = await service.locate(26.275, 73.015);
    expect(lookup.assembly_seat).toBeNull();
    expect(lookup.representatives.map((row) => row.office)).toEqual(["mp"]);
  });

  it("rejects coordinates outside WGS 84 as a bad request", async () => {
    const { service } = await serviceWith(PLACES.jodhpur);
    await expect(service.locate(91, 73)).rejects.toThrow(ValidationError);
    await expect(service.locate(Number.NaN, 73)).rejects.toThrow(/not a WGS 84 point/);
  });
});
