import { describe, expect, it } from "vitest";
import { LocalBody } from "../../src/domain/location/LocalBody.js";
import { Place } from "../../src/domain/location/Place.js";
import type { Representative, SeatMatch } from "../../src/domain/location/Seats.js";
import { LocalBodyResolver } from "../../src/services/location/LocalBodyResolver.js";
import { RepresentativeDirectory } from "../../src/services/location/RepresentativeDirectory.js";
import { PLACES } from "./samples.js";

const JODHPUR_MC = {
  id: "jodhpur-mc",
  name: "Jodhpur Municipal Corporation",
  head_office: "Commissioner",
  state: "Rajasthan",
  towns: ["Jodhpur"],
};

function row(office: Representative["office"], seatId: string): Representative {
  return { office, seat_id: seatId, as_of: "2026-10-10", source: "https://example.org/" };
}

describe("Place", () => {
  it.each([
    ["Rajasthan", "Jodhpur", "rajasthan-jodhpur"],
    ["Rajasthan", "Bhīlwāra", "rajasthan-bhilwara"],
    ["Andaman and Nicobar Islands", "South Andaman", "andaman-and-nicobar-islands-south-andaman"],
    ["Jammu & Kashmir", "Srinagar", "jammu-kashmir-srinagar"],
  ])("makes a contract area id from %s and %s", (state, district, id) => {
    const place = new Place({ countryCode: "IN", state, district, town: null });
    expect(place.districtRef()).toEqual({ id, name: district });
  });
});

describe("LocalBodyResolver", () => {
  const resolver = new LocalBodyResolver([new LocalBody(JODHPUR_MC)]);

  it("matches the town and state, ignoring case, and returns only contract fields", () => {
    const place = new Place({ ...PLACES.jodhpur, town: "JODHPUR" });
    expect(resolver.resolve(place)).toEqual({
      id: "jodhpur-mc",
      name: "Jodhpur Municipal Corporation",
      head_office: "Commissioner",
    });
  });

  it("returns null for an unknown town, a same-named town in another state, or no town", () => {
    expect(resolver.resolve(new Place(PLACES.delhi))).toBeNull();
    expect(resolver.resolve(new Place({ ...PLACES.jodhpur, state: "Gujarat" }))).toBeNull();
    expect(resolver.resolve(new Place({ ...PLACES.jodhpur, town: null }))).toBeNull();
  });
});

describe("RepresentativeDirectory", () => {
  const directory = new RepresentativeDirectory([
    row("mla", "s20-ac-127"),
    row("mp", "s20-pc-16"),
    row("mp", "u09-pc-1"),
  ]);
  const jodhpur: SeatMatch = {
    assembly: { id: "s20-ac-127", name: "Sardarpura", lokSabhaId: "s20-pc-16" },
    lokSabha: { id: "s20-pc-16", name: "Jodhpur", status: "current" },
  };

  it("lists the MLA, then the MP", () => {
    expect(directory.forSeats(jodhpur)).toEqual([row("mla", "s20-ac-127"), row("mp", "s20-pc-16")]);
  });

  it("gives no MLA row without an assembly seat", () => {
    expect(directory.forSeats({ ...jodhpur, assembly: null })).toEqual([row("mp", "s20-pc-16")]);
  });

  it("gives no MP row for an outdated seat", () => {
    const ladakh: SeatMatch = { assembly: null, lokSabha: { id: "u09-pc-1", name: "Ladakh", status: "outdated" } };
    expect(directory.forSeats(ladakh)).toEqual([]);
  });

  it("skips a seat that has no row", () => {
    const unknown: SeatMatch = {
      assembly: { id: "s20-ac-1", name: "Sadulshahar", lokSabhaId: "s20-pc-1" },
      lokSabha: { id: "s20-pc-1", name: "Ganganagar", status: "current" },
    };
    expect(directory.forSeats(unknown)).toEqual([]);
  });
});
