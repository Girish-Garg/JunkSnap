import { describe, expect, it } from "vitest";
import { validateLetterDraft, type Site } from "../../src/contracts/index.gen.js";
import { NotFoundError } from "../../src/domain/errors.js";
import { LetterSite } from "../../src/domain/letters/LetterSite.js";
import { SiteRejectedError } from "../../src/domain/sites/SiteErrors.js";
import { LetterPrompt } from "../../src/adapters/letters/LetterPrompt.js";
import type { LetterBrief } from "../../src/ports/letters/LetterWriter.js";
import { BackingClaimGuard } from "../../src/services/letters/BackingClaimGuard.js";
import type { LetterRequest } from "../../src/services/letters/LetterService.js";
import { DEVICE, downWriter, FakeWriter, letterService, memoryCounters, MODEL, RecordingLogger, siteWith, USER, wardSite } from "./support.js";

// Decision 20261011-1750: any open site takes a letter; the letter says how many people backed it and never calls it verified early.
const verified = wardSite();
const backers = { count: 3, needed: 10 as const, photo_people: 2, vote_people: 1 };
const waiting = siteWith(verified, { verification: "unverified", verified_count: 0, report_count: 3, reporters: 2, backers });
const request: LetterRequest = { siteId: "site_jdh_1", channel: "local_body", language: "en", requester: { deviceToken: DEVICE, userId: USER } };
const STANDALONE_SATYAPIT = /(?<![\p{L}\p{M}])सत्यापित(?![\p{L}\p{M}])/u;

async function templateFor(site: Site, language: "en" | "hi" = "en") {
  return (await letterService({ sites: [site], writer: downWriter() })).draft({ ...request, language });
}

// A model draft that quotes every rule word for word and adds one sentence of its own.
function modelSaying(sentence: string): FakeWriter {
  return new FakeWriter((brief) => {
    const quotes = brief.citations.map((citation) => `${citation.clause} says "${citation.quote}".`);
    return { subject: "Request to clear a waste site", body: `To the Commissioner.\n\n${sentence}\n\n${quotes.join("\n")}`, provenance: MODEL };
  });
}

describe("a letter for an unverified site", () => {
  it("drafts in English, saying how many people reported and backed it, never that it is verified", async () => {
    const letter = await templateFor(waiting);
    expect(() => validateLetterDraft(letter)).not.toThrow();
    expect(letter.body).toContain("Reports since 9 October 2026: 3.");
    expect(letter.body).toContain("Reported by 2 residents; community verification in progress (3 of 10 people confirmed so far).");
    expect(`${letter.subject}\n${letter.body}`).not.toMatch(/\bverified\b/i);
    expect(letter.evidence).toMatchObject({ verification: "unverified", backers: { count: 3, needed: 10 }, reporters: 2, verified_count: 0 });
  });

  it("drafts in Hindi with the same counts and no सत्यापित", async () => {
    const letter = await templateFor(waiting, "hi");
    expect(letter.body).toContain("2 निवासियों ने इसकी सूचना दी है; सामुदायिक पुष्टि जारी है (10 में से 3 लोगों ने अब तक पुष्टि की)।");
    expect(letter.body).toContain("से अब तक रिपोर्ट: 3।");
    expect(letter.body).not.toMatch(STANDALONE_SATYAPIT);
  });

  it("speaks of one resident, or of residents when the reporters were never counted", () => {
    const one = LetterSite.fromSite(siteWith(waiting, { reporters: 1, backers: { ...backers, count: 1 } }));
    const brief = (site: LetterSite): LetterBrief => ({ site, addressees: { channel: "local_body", to: { office: "Commissioner", body: "Jodhpur Municipal Corporation" }, cc: [], filingUrl: null }, citations: [], language: "en", binRadiusM: 3000 });
    expect(JSON.parse(new LetterPrompt(brief(one)).user())).toMatchObject({ community_status: "Reported by 1 resident; community verification in progress (1 of 10 people confirmed so far)." });
    const legacy = LetterSite.fromSite(siteWith(waiting, { reporters: undefined }));
    expect(JSON.parse(new LetterPrompt(brief(legacy)).user())).toMatchObject({
      community_status: "Reported by residents; community verification in progress (3 of 10 people confirmed so far).",
      site_verified: false,
      verified_reports: null,
    });
  });

  it("says verified, with the people who backed it, once 10 have", async () => {
    const letter = await templateFor(verified);
    expect(letter.body).toContain("Reports since 9 October 2026: 7 (7 verified). 10 people have confirmed this site, so it is verified.");
    expect(letter.evidence).toMatchObject({ verification: "verified", backers: { count: 10, needed: 10 } });
    expect((await templateFor(verified, "hi")).body).toContain("10 लोगों ने इस स्थान की पुष्टि की है, इसलिए यह सत्यापित है।");
  });
});

describe("a model draft for an unverified site", () => {
  it("falls back to the template, and says so, when it calls the site verified", async () => {
    const logger = new RecordingLogger();
    const writer = modelSaying("This site has been verified by residents.");
    const letter = await (await letterService({ sites: [waiting], writer, logger })).draft(request);
    expect(letter).toMatchObject({ template_fallback: true, provider: "junksnap", model: "letter-template", version: "1" });
    expect(letter.body).not.toContain("has been verified");
    expect(logger.warnings).toEqual([expect.stringContaining("letter writer failed")]);
  });

  it.each([
    ["verification in progress", "Reported by 2 residents; community verification is in progress (3 of 10 people confirmed so far)."],
    ["not yet verified", "This site is not yet verified: 3 of 10 people have confirmed it so far."],
    ["Hindi, not verified yet", "यह स्थल अभी सत्यापित नहीं है; 10 में से 3 लोगों ने अब तक पुष्टि की है।"],
  ])("ships the model's prose, with the model named, when it says %s", async (_name, sentence) => {
    const letter = await (await letterService({ sites: [waiting], writer: modelSaying(sentence) })).draft(request);
    expect(letter).toMatchObject({ template_fallback: false, ...MODEL });
    expect(letter.body).toContain(sentence);
  });

  it("ships for a verified site that says so", async () => {
    const letter = await (await letterService({ sites: [verified], writer: modelSaying("Ten residents verified it.") })).draft(request);
    expect(letter.template_fallback).toBe(false);
  });

  it("reads only the letter's own prose: a quoted rule may say verified", () => {
    const problem = (body: string, siteVerified = false) => BackingClaimGuard.problem({ subject: "Request", body, provenance: MODEL }, siteVerified);
    expect(problem('Rule 4 says "the quantity shall be verified by the authority".')).toBeNull();
    expect(problem("The site is Verified.")).toBe("calls an unverified site verified");
    expect(problem("It was verified by 3 people.", true)).toBe("says verified by fewer people than verification needs");
    expect(problem("It was verified by 12 people.", true)).toBeNull();
  });
});

describe("sites that take no letter", () => {
  it.each([
    ["withdrawn", "withdrawn"],
    ["photos_reported", "photos_reported"],
  ] as const)("refuses a site removed as %s with not_found, before counting", async (_name, reason) => {
    const counters = memoryCounters();
    const removed = siteWith(waiting, { status: "removed", removed_reason: reason, removed_at: "2026-10-10T07:00:00Z" });
    await expect((await letterService({ sites: [removed], counters })).draft(request)).rejects.toThrow(NotFoundError);
    expect([...counters.devices.taken, ...counters.users.taken]).toEqual([]);
  });

  it("refuses a rejected site with site_rejected", async () => {
    const rejected = siteWith(waiting, { verification: "rejected" });
    await expect((await letterService({ sites: [rejected] })).draft(request)).rejects.toThrow(SiteRejectedError);
  });

  it("still drafts for a cleaned site, as before, whether or not it was verified", async () => {
    const cleaned = siteWith(waiting, { status: "cleaned", cleaned_at: "2026-10-10T06:00:00Z", cleanup_status: "accepted" });
    await expect((await letterService({ sites: [cleaned], writer: downWriter() })).draft(request)).resolves.toMatchObject({ evidence: { verification: "unverified" } });
  });
});
