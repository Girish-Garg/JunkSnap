import type { ReverseGeocodeCommand, ReverseGeocodeCommandOutput } from "@aws-sdk/client-geo-places";
import { describe, expect, it, vi } from "vitest";
import { GeoPlacesReverseGeocoder } from "../../src/adapters/location/GeoPlacesReverseGeocoder.js";
import { ExternalServiceError } from "../../src/domain/errors.js";
import { GeoPoint } from "../../src/domain/location/GeoPoint.js";

const JDH_1 = GeoPoint.of(26.2618, 73.0035);

// Shape of the real jdh-1 answer (PR #32 evidence): Address.District is a neighbourhood.
const JDH_1_ADDRESS = {
  Country: { Code2: "IN", Code3: "IND", Name: "India" },
  Region: { Code: "RJ", Name: "Rajasthan" },
  SubRegion: { Name: "Jodhpur" },
  Locality: "Jodhpur",
  District: "Shastri Nagar",
};

function output(address?: object): ReverseGeocodeCommandOutput {
  const items = address === undefined ? [] : [{ PlaceId: "p", PlaceType: "Street", Title: "t", Address: address }];
  return { $metadata: {}, PricingBucket: "Core", ResultItems: items } as ReverseGeocodeCommandOutput;
}

function geocoderAnswering(answer: ReverseGeocodeCommandOutput | Error) {
  const send = answer instanceof Error ? vi.fn().mockRejectedValue(answer) : vi.fn().mockResolvedValue(answer);
  return { geocoder: new GeoPlacesReverseGeocoder({ send }), send };
}

describe("GeoPlacesReverseGeocoder", () => {
  it("asks Places v2 for one stored, English result at [lon, lat]", async () => {
    const { geocoder, send } = geocoderAnswering(output(JDH_1_ADDRESS));
    await geocoder.reverse(JDH_1);
    const command = send.mock.calls[0]?.[0] as ReverseGeocodeCommand;
    expect(command.input).toEqual({
      QueryPosition: [73.0035, 26.2618],
      MaxResults: 1,
      Language: "en",
      IntendedUse: "Storage",
    });
    expect(geocoder.name).toBe("amazon-location/places-v2");
  });

  it("reads state from Region and district from SubRegion, not Address.District", async () => {
    const { geocoder } = geocoderAnswering(output(JDH_1_ADDRESS));
    const place = await geocoder.reverse(JDH_1);
    expect(place).toMatchObject({ countryCode: "IN", state: "Rajasthan", district: "Jodhpur", town: "Jodhpur" });
    expect(place.districtRef()).toEqual({ id: "rajasthan-jodhpur", name: "Jodhpur" });
  });

  it("leaves the town null when there is no Locality", async () => {
    const { geocoder } = geocoderAnswering(output({ ...JDH_1_ADDRESS, Locality: undefined }));
    expect((await geocoder.reverse(JDH_1)).town).toBeNull();
  });

  it.each([
    ["no result", output()],
    ["no subregion", output({ ...JDH_1_ADDRESS, SubRegion: undefined })],
    ["no country", output({ ...JDH_1_ADDRESS, Country: undefined })],
  ])("fails with an ExternalServiceError on %s", async (_case, answer) => {
    const { geocoder } = geocoderAnswering(answer);
    await expect(geocoder.reverse(JDH_1)).rejects.toThrow(ExternalServiceError);
  });

  it("wraps an SDK failure, keeping it as the cause", async () => {
    const failure = new Error("AccessDeniedException");
    const { geocoder } = geocoderAnswering(failure);
    const error: unknown = await geocoder.reverse(JDH_1).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ExternalServiceError);
    expect((error as ExternalServiceError).cause).toBe(failure);
  });
});
