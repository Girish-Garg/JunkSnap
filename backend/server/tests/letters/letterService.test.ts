import { describe, expect, it } from "vitest";
import { validateLetterDraft, type LetterDraft } from "../../src/contracts/index.gen.js";
import { NotFoundError } from "../../src/domain/errors.js";
import { NotVerifiedError, RateLimitedError } from "../../src/domain/letters/errors.js";
import type { LetterRequest } from "../../src/services/letters/LetterService.js";
import {
  DEVICE,
  downWriter,
  FakeWriter,
  FixedStamp,
  letterService,
  memoryCounters,
  MODEL,
  quotingWriter,
  REAL_RULES_DIR,
  RecordingLogger,
  siteFixture,
  siteWith,
  wardSite,
} from "./support.js";

const jodhpur = wardSite();
const request: LetterRequest = {
  siteId: "site_jdh_1",
  channel: "local_body",
  language: "en",
  requester: { deviceToken: DEVICE, userId: null },
};

function expectValid(letter: LetterDraft): void {
  expect(() => validateLetterDraft(letter)).not.toThrow();
  expect(letter.verifier.verified).toBe(letter.verifier.total);
  expect(letter.verifier.total).toBe(letter.citations.length);
  expect(letter.citations.every((citation) => citation.verified)).toBe(true);
}

function quotedIn(letter: LetterDraft): boolean {
  return letter.citations.every((citation) => letter.body.includes(`"${citation.quote}"`));
}

describe("LetterService with a model draft", () => {
  it("ships the model's prose when every quote passes the verifier", async () => {
    const writer = quotingWriter();
    const letter = await (await letterService({ sites: [jodhpur], writer })).draft(request);
    expectValid(letter);
    expect(letter).toMatchObject({ template_fallback: false, ...MODEL, letter_id: "ltr_test_1" });
    expect(letter.created_at).toBe("2026-10-10T08:00:00Z");
    expect(letter.citations.map((citation) => citation.rule_id)).toEqual(["fx-hot-spots", "fx-dumpsites", "fx-vacant-plots"]);
    expect(letter.verifier).toEqual({ verified: 3, total: 3 });
    expect(quotedIn(letter)).toBe(true);
  });

  it("gives the writer code-picked addressees and citations only", async () => {
    const writer = quotingWriter();
    await (await letterService({ sites: [jodhpur], writer })).draft({ ...request, language: "hi" });
    const [brief] = writer.briefs;
    expect(brief?.language).toBe("hi");
    expect(brief?.addressees.to.office).toBe("Commissioner");
    expect(brief?.citations.map((citation) => citation.rule_id)).toHaveLength(3);
  });
});

describe("LetterService falls back to the template", () => {
  it("when the model misquotes a rule, keeping the same verified citations", async () => {
    const logger = new RecordingLogger();
    const writer = quotingWriter((quote) => quote.replace("garbage", "rubbish"));
    const letter = await (await letterService({ sites: [jodhpur], writer, logger })).draft(request);
    expectValid(letter);
    expect(letter).toMatchObject({ template_fallback: true, provider: "junksnap", model: "letter-template" });
    expect(letter.body).not.toContain("rubbish");
    expect(quotedIn(letter)).toBe(true);
    expect(logger.warnings).toEqual([expect.stringContaining("failed the quote verifier")]);
  });

  it("when the model adds a quote that is not in the cited text", async () => {
    const writer = new FakeWriter((brief) => {
      const body = brief.citations.map((citation) => `"${citation.quote}"`).join(" ");
      return { subject: "Request", body: `${body} The rules also say "fines double every week".`, provenance: MODEL };
    });
    const letter = await (await letterService({ sites: [jodhpur], writer })).draft(request);
    expect(letter.template_fallback).toBe(true);
    expect(letter.body).not.toContain("fines double");
  });

  it.each(["", "x".repeat(201)])("when the model's subject is empty or too long (%#)", async (subject) => {
    const writer = quotingWriter((quote) => quote, subject);
    const letter = await (await letterService({ sites: [jodhpur], writer })).draft(request);
    expect(letter.template_fallback).toBe(true);
  });

  it("when every model provider fails", async () => {
    const logger = new RecordingLogger();
    const service = await letterService({ sites: [jodhpur], writer: downWriter(), logger });
    const letter = await service.draft(request);
    expectValid(letter);
    expect(letter.template_fallback).toBe(true);
    expect(logger.warnings).toEqual([expect.stringContaining("letter writer failed")]);
  });
});

describe("Template letter", () => {
  it("is neutral, addressed by office, and quotes each rule in full", async () => {
    const letter = await (await letterService({ sites: [jodhpur], writer: downWriter() })).draft(request);
    expect(letter.subject).toBe(
      "Request for action on a waste dump on a vacant plot in Ward 37, Jodhpur (JunkSnap site site_jdh_1)",
    );
    expect(letter.body).toMatch(/^To the Commissioner, Jodhpur Municipal Corporation\./);
    expect(letter.body).toContain("Reports since 9 October 2026: 7 (6 verified).");
    expect(letter.body).toContain("Sample Waste Rules (test fixture), rule 39(2)(vii):\n\"plan for collection");
    expect(letter.body).toContain(
      "Copies go for attention to the councillor of Ward 37, the MLA for Sardarpura and the MP for Jodhpur.",
    );
    expect(letter.cc.every((line) => line.marking === "for attention")).toBe(true);
  });

  it("writes Hindi prose around the official English quotes", async () => {
    const service = await letterService({ sites: [jodhpur], writer: downWriter() });
    const letter = await service.draft({ ...request, language: "hi" });
    expectValid(letter);
    expect(letter.language).toBe("hi");
    expect(letter.body).toMatch(/^सेवा में,\nCommissioner,/);
    expect(letter.body).toContain("प्रतिलिपि सूचनार्थ: Ward 37 के पार्षद, Sardarpura के विधायक और Jodhpur के सांसद।");
    expect(quotedIn(letter)).toBe(true);
  });
});

describe("LetterService errors", () => {
  it("returns not_found for an unknown site", async () => {
    await expect((await letterService({ sites: [] })).draft(request)).rejects.toThrow(NotFoundError);
  });

  it("returns not_verified unless the site is verified", async () => {
    const waiting = siteWith(jodhpur, { verification: "community_check" });
    const service = await letterService({ sites: [waiting] });
    await expect(service.draft(request)).rejects.toThrow(NotVerifiedError);
  });

  it("allows 5 letters an hour per device, then rate_limited, then again after an hour", async () => {
    const stamp = new FixedStamp();
    const service = await letterService({ sites: [jodhpur], stamp });
    for (let letter = 0; letter < 5; letter += 1) {
      await service.draft(request);
    }
    await expect(service.draft(request)).rejects.toThrow(RateLimitedError);
    await service.draft({ ...request, requester: { deviceToken: "another-device", userId: null } });
    stamp.advance(3_600_000);
    await expect(service.draft(request)).resolves.toMatchObject({ site_id: "site_jdh_1" });
  });

  it("limits a signed-in user across devices: the stricter counter applies", async () => {
    const counters = memoryCounters();
    const service = await letterService({ sites: [jodhpur], counters });
    for (let device = 0; device < 5; device += 1) {
      await service.draft({ ...request, requester: { deviceToken: `device-${device}`, userId: "usr_1" } });
    }
    const sixth = { ...request, requester: { deviceToken: "device-6", userId: "usr_1" } };
    await expect(service.draft(sixth)).rejects.toThrow(RateLimitedError);
    expect(counters.devices.taken).not.toContain("device-6");
  });

  it("does not count a request that fails before drafting", async () => {
    const counters = memoryCounters();
    const waiting = siteWith(jodhpur, { verification: "rejected" });
    await expect((await letterService({ sites: [waiting], counters })).draft(request)).rejects.toThrow(NotVerifiedError);
    expect([...counters.devices.taken, ...counters.users.taken]).toEqual([]);
  });
});

describe("A letter with the real rule book", () => {
  it.each(["en", "hi"] as const)("cites four verified SWM clauses for the jdh-1 dump (%s)", async (language) => {
    const service = await letterService({ sites: [jodhpur], writer: downWriter(), rulesDir: REAL_RULES_DIR });
    const letter = await service.draft({ ...request, language });
    expectValid(letter);
    expect(letter.verifier).toEqual({ verified: 4, total: 4 });
    expect(letter.citations.map((citation) => citation.clause).sort()).toEqual(["15(1)", "39(2)(vii)", "39(2)(xi)", "5(1)(f)"]);
    expect(letter.citations[0]?.document).toBe(
      "Solid Waste Management Rules, 2026 (S.O. 388(E), 27 January 2026, in force 1 April 2026)",
    );
    expect(quotedIn(letter)).toBe(true);
  });

  it("ships a model draft that quotes the real rules word for word", async () => {
    const service = await letterService({ sites: [jodhpur], rulesDir: REAL_RULES_DIR });
    const letter = await service.draft(request);
    expect(letter).toMatchObject({ template_fallback: false, verifier: { verified: 4, total: 4 } });
  });

  it("copies only the MLA and MP for the jdh-1 fixture, which has no ward", async () => {
    const service = await letterService({ sites: [siteFixture("jdh-1")], rulesDir: REAL_RULES_DIR });
    const letter = await service.draft(request);
    expect(letter.cc.map((line) => line.office)).toEqual(["mla", "mp"]);
  });
});
