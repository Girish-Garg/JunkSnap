import { describe, expect, it } from "vitest";
import type { VerificationResult } from "../src/contracts/index.gen.js";
import { ReportConfirmation } from "../src/domain/ReportConfirmation.js";
import { fixture } from "./reportFakes.js";

const unsure = (): VerificationResult => fixture<VerificationResult>("verification_result.jdh-confirm");
const WINDOW = { askedAt: "2026-10-11T09:40:14Z", expiresAt: "2026-10-12T09:40:14Z" };

describe("ReportConfirmation.ask", () => {
  it("builds the contract's question and keeps the judge's rationale as the reasoning", () => {
    expect(ReportConfirmation.ask("waste_dump", unsure(), WINDOW).toRecord()).toEqual({
      question: "Our check wasn't sure this shows a waste dump. Only report it if you're 100% sure.",
      reasoning: "A roadside with a few scattered items; it is hard to tell whether they are waste.",
      report_type: "waste_dump",
      asked_at: "2026-10-11T09:40:14Z",
      expires_at: "2026-10-12T09:40:14Z",
      answer: null,
      answered_at: null,
    });
  });

  it.each([
    ["overflowing_bin", "an overflowing or broken bin"],
    ["contaminated_water", "contaminated water"],
    ["open_construction", "open construction debris"],
  ] as const)("names %s plainly", (type, label) => {
    expect(ReportConfirmation.ask(type, unsure(), WINDOW).toRecord().question).toContain(`this shows ${label}.`);
  });

  it("gives an empty reasoning when no judge answered", () => {
    expect(ReportConfirmation.ask("waste_dump", { ...unsure(), judge: null }, WINDOW).toRecord().reasoning).toBe("");
  });
});

describe("ReportConfirmation.reasoning", () => {
  it("removes control characters, turns line breaks and tabs into spaces, collapses whitespace and trims", () => {
    expect(ReportConfirmation.reasoning("  A pile\u0000 of\n\nbags\tnear\u0007 a  wall.\r\n ")).toBe("A pile of bags near a wall.");
  });

  it("cuts to 300 characters without leaving a trailing space or a half character", () => {
    const long = `${"a".repeat(299)} ${"b".repeat(50)}`;
    expect(ReportConfirmation.reasoning(long)).toBe("a".repeat(299));
    const emoji = `${"x".repeat(299)}\u{1F5D1}\u{1F5D1}`;
    expect(Array.from(ReportConfirmation.reasoning(emoji))).toHaveLength(300);
    expect(ReportConfirmation.reasoning(emoji).endsWith("\u{1F5D1}")).toBe(true);
  });
});

describe("ReportConfirmation answers and expiry", () => {
  const asked = () => ReportConfirmation.ask("waste_dump", unsure(), WINDOW);

  it("records sure as processing and not sure as withdrawn", () => {
    const sure = asked().answer("needs_confirmation", true, "2026-10-11T10:00:00Z");
    expect(sure.outcome).toBe("recorded");
    expect(sure.changes).toMatchObject({ status: "processing", confirmation: { answer: "sure", answered_at: "2026-10-11T10:00:00Z" } });
    const no = asked().answer("needs_confirmation", false, "2026-10-11T10:00:00Z");
    expect(no.changes).toMatchObject({ status: "withdrawn", withdrawn_at: "2026-10-11T10:00:00Z", confirmation: { answer: "withdrawn" } });
  });

  it("closes the window exactly at expires_at, with answered_at the closing time", () => {
    expect(asked().answer("needs_confirmation", true, "2026-10-12T09:40:13Z").outcome).toBe("recorded");
    const late = asked().answer("needs_confirmation", true, "2026-10-12T09:40:14Z");
    expect(late.outcome).toBe("expired");
    expect(late.changes).toMatchObject({ status: "not_confirmed", confirmation: { answer: "expired", answered_at: WINDOW.expiresAt } });
  });

  it("reads as expired only while still waiting", () => {
    expect(asked().expiry("needs_confirmation", "2026-10-12T09:40:13Z")).toBeNull();
    expect(asked().expiry("needs_confirmation", "2026-10-13T00:00:00Z")).toMatchObject({ status: "not_confirmed" });
    expect(asked().expiry("processing", "2026-10-13T00:00:00Z")).toBeNull();
  });
});
