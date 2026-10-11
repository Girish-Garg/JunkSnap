import { describe, expect, it } from "vitest";
import type { Site } from "../../src/contracts/index.gen.js";
import { AreaKey } from "../../src/domain/AreaKey.js";
import { CountNoun } from "../../src/domain/CountNoun.js";
import { BackingStatement } from "../../src/domain/letters/BackingStatement.js";
import { LetterSite } from "../../src/domain/letters/LetterSite.js";
import { NoBinStatement } from "../../src/domain/letters/NoBinStatement.js";
import { CommunityPhrases } from "../../src/domain/notes/CommunityPhrases.js";
import { ASSEMBLY, areaLetterService, areaSite, REQUESTER } from "./areaSupport.js";
import { siteFixture, siteWith, wardSite } from "./support.js";

// A letter goes to an official: one person is "1 person" and "1 व्यक्ति", never "1 people" or "1 लोगों".
const backed = (base: Site, people: number, verification: "verified" | "unverified" = "unverified") =>
  LetterSite.fromSite(siteWith(base, { verification, reporters: people, backers: { count: people, needed: 10, photo_people: people, vote_people: 0 } }));
const signals = { duration_days: null, recurring: null, burning: true, smell: false, blocked_drain: false, animals: false, near_school: false, near_hospital: false, access_issue: false };

describe("counts in site letters", () => {
  it("names one person or several in a count noun", () => {
    expect(new CountNoun("person", "people").of(1)).toBe("1 person");
    expect(new CountNoun("person", "people").of(3)).toBe("3 people");
  });

  it("says who backed a site, for 1 and for several, in English and Hindi", () => {
    const statement = new BackingStatement();
    expect(statement.english(backed(wardSite(), 1))).toBe("Reported by 1 resident; community verification in progress (1 of 10 people confirmed so far).");
    expect(statement.english(backed(wardSite(), 3))).toBe("Reported by 3 residents; community verification in progress (3 of 10 people confirmed so far).");
    expect(statement.hindi(backed(wardSite(), 1))).toBe("1 निवासी ने इसकी सूचना दी है; सामुदायिक पुष्टि जारी है (10 में से 1 व्यक्ति ने अब तक पुष्टि की)।");
    expect(statement.hindi(backed(wardSite(), 3))).toBe("3 निवासियों ने इसकी सूचना दी है; सामुदायिक पुष्टि जारी है (10 में से 3 लोगों ने अब तक पुष्टि की)।");
    expect(statement.english(backed(wardSite(), 12, "verified"))).toBe("12 people confirmed this site, so it is verified.");
  });

  it("says who confirmed a no-bin zone, for 1 and for several, in English and Hindi", () => {
    const zone = siteFixture("jdh-2");
    const statement = new NoBinStatement(3000);
    const first = backed(siteWith(zone, { insights: undefined }), 1);
    const many = backed(siteWith(zone, { insights: undefined }), 4);
    expect(statement.english(first)).toBe("1 person has confirmed there is no dustbin within 1 km of this spot.");
    expect(statement.english(many)).toBe("4 people confirmed there is no dustbin within 1 km of this spot.");
    expect(statement.hindi(first)).toBe("1 व्यक्ति ने पुष्टि की है कि इस जगह के 1 किलोमीटर के भीतर कोई कूड़ेदान नहीं है।");
    expect(statement.hindi(many)).toBe("4 लोगों ने पुष्टि की है कि इस जगह के 1 किलोमीटर के भीतर कोई कूड़ेदान नहीं है।");
  });

  it("counts the residents behind notes in Hindi, for 1 and for several", () => {
    const hindi = new CommunityPhrases("hi");
    expect(hindi.report(1, signals)).toMatch(/^निवासियों की सूचना \(1 व्यक्ति\): /);
    expect(hindi.report(4, signals)).toMatch(/^निवासियों की सूचना \(4 लोग\): /);
    expect(hindi.line(1, signals)).toMatch(/^1 निवासी के अनुसार: /);
    expect(hindi.line(4, signals)).toMatch(/^4 निवासियों के अनुसार: /);
    expect(hindi.areaReport(1, 1, [])).toBe("1 स्थल पर निवासियों की सूचना (1 व्यक्ति)।");
    expect(hindi.areaReport(2, 5, [])).toBe("2 स्थलों पर निवासियों की सूचना (5 लोग)।");
  });
});

describe("counts in area letters", () => {
  const request = { area: AreaKey.parse("assembly", ASSEMBLY), issue: "waste_dump", requester: REQUESTER } as const;

  it("says one person at one site in English and Hindi", async () => {
    const sites = [areaSite("solo", { verified_count: 10, report_count: 10 })];
    const english = await (await areaLetterService({ sites })).draft({ ...request, language: "en" });
    expect(english.body).toContain("10 reports from 1 person at 1 site since");
    const hindi = await (await areaLetterService({ sites })).draft({ ...request, language: "hi" });
    expect(hindi.body).toContain("1 स्थल पर 10 रिपोर्ट (1 व्यक्ति द्वारा)");
  });

  it("says several people at several sites in Hindi", async () => {
    const hindi = await (await areaLetterService()).draft({ ...request, language: "hi" });
    expect(hindi.body).toContain("3 स्थलों पर 14 रिपोर्ट (4 लोगों द्वारा)");
  });
});
