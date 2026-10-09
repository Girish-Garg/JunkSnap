import { beforeAll, describe, expect, it } from "vitest";
import { validateLocationLookup } from "../../src/contracts/index.gen.js";
import { LocationServiceFactory } from "../../src/handlers/LocationServiceFactory.js";
import type { LocationService } from "../../src/services/location/LocationService.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import { CHURU_SLIVER, DELHI, JAIPUR_SLIVER, LEH, SAMPLES, SANGARIA_OVERLAP } from "./samples.js";

// Calls Amazon Location for real: RUN_AWS_TESTS=1 with credentials for ap-south-1.
describe.runIf(process.env.RUN_AWS_TESTS === "1")("LocationService with Amazon Location", () => {
  let service: LocationService;

  beforeAll(async () => {
    const core = CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev", AWS_REGION: process.env.AWS_REGION });
    service = await LocationServiceFactory.fromEnv(core, process.env).create();
  });

  it.each(SAMPLES)("locates $sample", async ({ sample, lat, lon, assembly, loksabha }) => {
    const lookup = await service.locate(lat, lon);
    console.log(sample, JSON.stringify(lookup));
    expect(lookup).toMatchObject({ state: "Rajasthan", geocoder: "amazon-location/places-v2" });
    expect(lookup.assembly_seat?.id).toBe(assembly);
    expect(lookup.loksabha_seat.id).toBe(loksabha);
    expect(() => validateLocationLookup(lookup)).not.toThrow();
  });

  it.each([
    { name: "Delhi", ...DELHI, loksabha: "u05-pc-4", mpRows: 1 },
    { name: "Leh", ...LEH, loksabha: "u09-pc-1", mpRows: 0 },
  ])("locates $name outside Rajasthan, with no assembly seat", async ({ name, lat, lon, loksabha, mpRows }) => {
    const lookup = await service.locate(lat, lon);
    console.log(name, JSON.stringify(lookup));
    expect(lookup.district.id).toMatch(/^[a-z0-9-]+$/);
    expect(lookup.assembly_seat).toBeNull();
    expect(lookup.loksabha_seat.id).toBe(loksabha);
    expect(lookup.representatives).toHaveLength(mpRows);
    expect(() => validateLocationLookup(lookup)).not.toThrow();
  });

  it.each([
    { name: "Jaipur sliver", ...JAIPUR_SLIVER, assembly: "s20-ac-50", loksabha: "s20-pc-7" },
    { name: "Churu sliver", ...CHURU_SLIVER, assembly: "s20-ac-24", loksabha: "s20-pc-3" },
    { name: "Sangaria border, Punjab per Amazon", ...SANGARIA_OVERLAP, assembly: null, loksabha: "s19-pc-10" },
  ])("locates the $name", async ({ name, lat, lon, assembly, loksabha }) => {
    const lookup = await service.locate(lat, lon);
    console.log(name, JSON.stringify(lookup));
    expect(lookup.assembly_seat?.id ?? null).toBe(assembly);
    expect(lookup.loksabha_seat.id).toBe(loksabha);
    expect(() => validateLocationLookup(lookup)).not.toThrow();
  });
});
