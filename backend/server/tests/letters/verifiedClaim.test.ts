import { describe, expect, it } from "vitest";
import { VerifiedClaim } from "../../src/services/letters/VerifiedClaim.js";

// Decision 20261011-1750: honest prose about an unverified site may name verification; only a claim that it is verified fails.
describe("VerifiedClaim allows saying a site is not verified yet", () => {
  it.each([
    "This site is not verified.",
    "This site is not yet verified.",
    "It has not been verified yet.",
    "It hasn't been verified.",
    "The site is unverified.",
    "It is yet to be verified by residents.",
    "It is awaiting verification.",
    "Community verification in progress (3 of 10 people confirmed so far).",
    "Verification is pending; 3 of 10 people have confirmed it.",
    "Pending verification by 10 residents.",
    "It will be verified once 10 people confirm it.",
    "The rules below are quoted and verified word for word.",
  ])("English: %s", (prose) => {
    expect(new VerifiedClaim(prose).affirms()).toBe(false);
  });

  it.each([
    "यह स्थल सत्यापित नहीं है।",
    "यह स्थल अभी सत्यापित नहीं हुआ है।",
    "यह स्थल असत्यापित है।",
    "सामुदायिक सत्यापन जारी है (10 में से 3 लोगों ने पुष्टि की)।",
    "इसका सत्यापन बाकी है।",
    "इसे अभी सत्यापित होना बाकी है।",
    "10 लोगों की पुष्टि के बाद यह सत्यापित होगा।",
  ])("Hindi: %s", (prose) => {
    expect(new VerifiedClaim(prose).affirms()).toBe(false);
  });
});

describe("VerifiedClaim catches a claim that the site is verified", () => {
  it.each([
    "This site is verified.",
    "The site has been verified by residents.",
    "Residents report a verified site at this spot.",
    "It was verified by 3 people.",
    "Not only reported but verified.",
  ])("English: %s", (prose) => {
    expect(new VerifiedClaim(prose).affirms()).toBe(true);
  });

  it.each(["यह स्थल सत्यापित है।", "इस स्थल को निवासियों द्वारा सत्यापित किया गया है।", "3 लोगों द्वारा सत्यापित स्थल।"])(
    "Hindi: %s",
    (prose) => {
      expect(new VerifiedClaim(prose).affirms()).toBe(true);
    },
  );

  it("finds the claim next to an honest phrase", () => {
    expect(new VerifiedClaim("It is not yet verified by the city, but residents have verified it.").affirms()).toBe(true);
  });
});

describe("VerifiedClaim counts the people a claim names", () => {
  it.each([
    ["verified by 3 people", true],
    ["verified by 9 residents", true],
    ["3 लोगों द्वारा सत्यापित", true],
    ["verified by 10 people", false],
    ["12 लोगों द्वारा सत्यापित", false],
    ["confirmed by 3 people so far", false],
  ] as const)("%s: under 10 is %s", (prose, under) => {
    expect(new VerifiedClaim(prose).undercounts()).toBe(under);
  });
});
