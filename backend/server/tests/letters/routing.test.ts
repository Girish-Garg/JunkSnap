import { beforeAll, describe, expect, it } from "vitest";
import { AssetFiles } from "../../src/adapters/letters/AssetFiles.js";
import { RoutingRepository } from "../../src/adapters/letters/RoutingRepository.js";
import { RuleRepository } from "../../src/adapters/letters/RuleRepository.js";
import type { Site } from "../../src/contracts/index.gen.js";
import { ConfigError, ValidationError } from "../../src/domain/errors.js";
import { ChannelNotApplicableError, NoLocalBodyError } from "../../src/domain/letters/errors.js";
import { LetterSite } from "../../src/domain/letters/LetterSite.js";
import type { RuleBook } from "../../src/domain/letters/RuleBook.js";
import type { Channel } from "../../src/domain/letters/types.js";
import { ClausePicker } from "../../src/services/letters/ClausePicker.js";
import { LetterRouter } from "../../src/services/letters/LetterRouter.js";
import { FIXTURE_RULES_DIR, REAL_RULES_DIR, siteFixture, siteWith, wardSite } from "./support.js";

const jodhpur = wardSite();
const water = siteFixture("jdh-3");
const construction = siteWith(siteFixture("jpr-1"), { verification: "verified" });
const delhi = wardSite({ state: "Delhi", district: { id: "delhi-new-delhi", name: "New Delhi" } });
const offices = (cc: readonly { office: string }[]) => cc.map((line) => line.office);

let router: LetterRouter;
let book: RuleBook;

beforeAll(async () => {
  const files = new AssetFiles(REAL_RULES_DIR);
  router = new LetterRouter(await new RoutingRepository(files).load());
  book = await new RuleRepository(new AssetFiles(FIXTURE_RULES_DIR)).load();
});

function route(channel: Channel, site: Site) {
  return router.route(channel, LetterSite.fromSite(site));
}

describe("LetterRouter with data/rules/routing.json: who a letter goes to", () => {
  it("addresses the local body head and copies councillor, MLA and MP for attention", () => {
    const addressees = route("local_body", jodhpur);
    expect(addressees.to).toEqual({ office: "Commissioner", body: "Jodhpur Municipal Corporation" });
    expect(addressees.cc).toEqual([
      { office: "councillor", seat: { id: "jodhpur-mc-w37", name: "Ward 37" }, marking: "for attention" },
      { office: "mla", seat: { id: "s20-ac-127", name: "Sardarpura" }, marking: "for attention" },
      { office: "mp", seat: { id: "s20-pc-16", name: "Jodhpur" }, marking: "for attention" },
    ]);
    expect(addressees.filingUrl).toBeNull();
  });

  it.each<[Channel, string, string, string | null]>([
    ["district_collector", "District Collector", "Jodhpur district, Rajasthan", null],
    ["cpgrams", "Public Grievance Officer", "Ministry of Housing and Urban Affairs, Government of India", "https://pgportal.gov.in/"],
    ["swachhata", "Commissioner", "Jodhpur Municipal Corporation", "https://play.google.com/store/apps/details?id=com.ichangemycity.swachhbharat"],
    ["rajasthan_sampark", "Grievance Officer", "Rajasthan Sampark, Government of Rajasthan", "https://sampark.rajasthan.gov.in/"],
  ])("routes a Jodhpur waste dump on %s", (channel, office, body, filingUrl) => {
    const addressees = route(channel, jodhpur);
    expect(addressees.to).toEqual({ office, body });
    expect(addressees.filingUrl).toBe(filingUrl);
    expect(offices(addressees.cc)).toEqual(["councillor", "mla", "mp"]);
  });

  it.each([
    ["contaminated water", water],
    ["open construction", construction],
    ["burning waste", siteWith(jodhpur, { burning: true })],
  ])("sends %s to the state pollution board, named for Rajasthan", (_name, site) => {
    const to = route("pollution_board", site).to;
    expect(to).toEqual({ office: "Member Secretary", body: "Rajasthan State Pollution Control Board" });
  });

  it("names the generic pollution board outside the listed states", () => {
    const to = route("pollution_board", siteWith(delhi, { burning: true })).to;
    expect(to.body).toBe("State Pollution Control Board or Pollution Control Committee, Delhi");
  });

  it("refuses a pollution board letter for an unburnt waste dump", () => {
    expect(() => route("pollution_board", jodhpur)).toThrow(ChannelNotApplicableError);
    expect(new ChannelNotApplicableError("x")).toBeInstanceOf(ValidationError);
  });

  it("offers Rajasthan Sampark only in Rajasthan", () => {
    expect(() => route("rajasthan_sampark", delhi)).toThrow(ChannelNotApplicableError);
    expect(route("cpgrams", delhi).to.office).toBe("Public Grievance Officer");
  });

  it("refuses the district collector for contaminated water, which no stored rule covers", () => {
    expect(() => route("district_collector", water)).toThrow(ChannelNotApplicableError);
  });

  it("returns no_local_body when a local-body channel has no body to address", () => {
    const site = wardSite({ local_body: null });
    expect(() => route("local_body", site)).toThrow(NoLocalBodyError);
    expect(() => route("swachhata", site)).toThrow(NoLocalBodyError);
    expect(route("district_collector", site).to.office).toBe("District Collector");
  });
});

describe("LetterRouter: Cc for attention", () => {
  it("never copies the MP of an outdated Lok Sabha seat", () => {
    const outdated = wardSite({ loksabha_seat: { id: "s20-pc-16", name: "Jodhpur", status: "outdated" } });
    expect(offices(route("local_body", outdated).cc)).toEqual(["councillor", "mla"]);
    const unknown = wardSite({ loksabha_seat: { id: "s20-pc-16", name: "Jodhpur", status: null } });
    expect(offices(route("local_body", unknown).cc)).toEqual(["councillor", "mla", "mp"]);
  });

  it("never copies an MLA when the site has no assembly seat", () => {
    expect(offices(route("cpgrams", wardSite({ assembly_seat: null })).cc)).toEqual(["councillor", "mp"]);
  });

  it("copies the councillor only when the site has a ward", () => {
    expect(offices(route("local_body", construction).cc)).toEqual(["mla", "mp"]);
    expect(offices(route("local_body", siteFixture("jdh-1")).cc)).toEqual(["mla", "mp"]);
  });

  it("copies only offices with a listed representative for that exact seat", () => {
    const representatives = [{ office: "mla" as const, seat_id: "s20-ac-999", as_of: "2026-10-01", source: "https://eci.gov.in/" }];
    expect(route("local_body", wardSite({ representatives })).cc).toEqual([]);
  });
});

describe("ClausePicker", () => {
  const pick = (channel: Channel, site = jodhpur, rules = book) =>
    new ClausePicker(rules).pick(channel, LetterSite.fromSite(site)).map((rule) => rule.ruleId);

  it("picks rules for the channel, best tag match first, narrower rule on a tie", () => {
    expect(pick("local_body")).toEqual(["fx-hot-spots", "fx-dumpsites", "fx-vacant-plots"]);
    expect(pick("district_collector")).toEqual(["fx-dumpsites"]);
  });

  it("picks by report type and context", () => {
    expect(pick("local_body", water)).toEqual(["fx-water"]);
    expect(pick("local_body", construction)).toEqual(["fx-dust"]);
    const noBin = siteWith(jodhpur, { report_type: "no_bin", context: "no_pickup" });
    expect(pick("local_body", noBin)).toEqual(["fx-bins"]);
  });

  it("adds the burning rule for a burning site", () => {
    expect(pick("pollution_board", siteWith(jodhpur, { burning: true }))).toEqual(["fx-burning"]);
    expect(pick("pollution_board")).toEqual(["fx-burning"]);
  });

  it("weighs a hazard from the site insights like burning", () => {
    const situation = LetterSite.fromSite(jodhpur).situation();
    expect(situation.weightOf("medical_waste")).toBe(0);
    const source = { signal: "vision_judge", provider: "bedrock", model: "global.anthropic.claude-sonnet-4-6", version: "4.6" } as const;
    const hazards: [{ hazard: "medical_waste"; reports: number; sources: [typeof source] }] = [
      { hazard: "medical_waste", reports: 1, sources: [source] },
    ];
    const hazardous = siteWith(jodhpur, { insights: { reports: 1, composition: [], size_class: null, hazards, near: [] } });
    expect(LetterSite.fromSite(hazardous).situation().weightOf("medical_waste")).toBe(2);
  });

  it("caps the clauses per letter", () => {
    expect(new ClausePicker(book, 1).pick("local_body", LetterSite.fromSite(jodhpur))).toHaveLength(1);
  });

  it("cites decision 12's four SWM clauses for a vacant-plot dump with the real rules", async () => {
    const real = await new RuleRepository(new AssetFiles(REAL_RULES_DIR)).load();
    const picked = pick("local_body", jodhpur, real).sort();
    expect(picked).toEqual(["swm-2026-15-1", "swm-2026-39-2-vii", "swm-2026-39-2-xi", "swm-2026-5-1-f"]);
  });
});

describe("RuleRepository and RoutingRepository", () => {
  it("refuse to start when ASSETS_DIR has no rules", async () => {
    const files = new AssetFiles(`${FIXTURE_RULES_DIR}missing/`);
    await expect(new RuleRepository(files).load()).rejects.toThrow(ConfigError);
    await expect(new RoutingRepository(files).load()).rejects.toThrow(/check ASSETS_DIR/);
  });
});
