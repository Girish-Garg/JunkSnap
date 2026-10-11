import { BackingStatement } from "../../domain/letters/BackingStatement.js";
import { NoBinStatement } from "../../domain/letters/NoBinStatement.js";
import type { Language, ReportType } from "../../domain/letters/types.js";
import { CommunityPhrases } from "../../domain/notes/CommunityPhrases.js";
import type { LetterBrief } from "../../ports/letters/LetterWriter.js";

const LANGUAGES: Readonly<Record<Language, string>> = { en: "English", hi: "Hindi in Devanagari script" };

const REQUEST: Readonly<Record<ReportType, string>> = {
  waste_dump: "clear the site and provide a bin or collection point nearby",
  no_bin: "place waste bins here and arrange regular collection",
  contaminated_water: "clean the water and drains here and check the source of contamination",
  open_construction: "cover or remove the debris and enforce dust control measures",
  overflowing_bin: "empty the bin regularly and repair or replace it",
};

const RULES = [
  "You draft a short, polite, neutral letter that a resident in India will file with a public office about a waste site.",
  "Use only the facts given. Never invent dates, numbers, names, places, rules or deadlines.",
  "Address the office in `to` by its office title only, and end with one sentence copying each `cc` office for attention.",
  "Never name or describe any person, never blame anyone, never mention a political party, and never use the words illegal or culprit.",
  "Quote every rule in `citations` exactly as given, character for character, inside straight double quotes.",
  "Give each citation its own short paragraph: its document and clause, then the quote.",
  "Do not add a signature, a name or a placeholder for one; the resident signs.",
  "State community_status as one sentence with its counts. When site_verified is false, never say the site is verified: say it is not verified yet and community verification is in progress.",
  "If residents_report is given, add it as one sentence in your own words with its count of people; never quote residents.",
  "If no_bin_statement is given, state it as plain prose before the request, keeping its counts, distances and sources; never inside quotation marks.",
  "Keep the quotes in English even when the letter is in another language.",
  "Use quotation marks for nothing else: not around document names, clauses, ids, places or the subject.",
  "Ask for the action in `request` and keep the body under 300 words. Keep the subject under 150 characters.",
  'Reply with one JSON object {"subject": string, "body": string} and nothing else.',
];

export class LetterPrompt {
  readonly #brief: LetterBrief;

  constructor(brief: LetterBrief) {
    this.#brief = brief;
  }

  system(): string {
    return [...RULES, `Write the subject and the prose in ${LANGUAGES[this.#brief.language]}.`].join("\n");
  }

  // A plain fact, never a quoted passage: the draft check accepts quotes only from cited rules.
  #noBinStatement(): string | null {
    const { site, binRadiusM } = this.#brief;
    return site.reportType === "no_bin" ? new NoBinStatement(binRadiusM).english(site) : null;
  }

  user(): string {
    const { site, addressees, citations } = this.#brief;
    const { verifiedCount, ...evidence } = site.evidence;
    const facts = {
      site_id: site.siteId,
      report_type: site.reportType,
      context: site.context,
      burning_seen: site.burning,
      place: site.place.name(),
      ...evidence,
      // Decision 20261011-1750: an unverified site counts no verified reports; community_status says how far it is.
      verified_reports: site.verified ? verifiedCount : null,
      site_verified: site.verified,
      community_status: new BackingStatement().english(site),
      to: addressees.to,
      cc: addressees.cc.map((line) => ({ office: line.office, seat: line.seat.name, marking: line.marking })),
      citations: citations.map(({ document, clause, quote }) => ({ document, clause, quote })),
      no_bin_statement: this.#noBinStatement(),
      request: REQUEST[site.reportType],
      residents_report:
        site.evidence.residents === null
          ? null
          : new CommunityPhrases("en").report(site.evidence.residents.people, site.evidence.residents.signals),
    };
    return JSON.stringify(facts, null, 2);
  }
}
