import type { Language, ReportType } from "../../domain/letters/types.js";
import type { LetterBrief } from "../../ports/letters/LetterWriter.js";

const LANGUAGES: Readonly<Record<Language, string>> = { en: "English", hi: "Hindi in Devanagari script" };

const REQUEST: Readonly<Record<ReportType, string>> = {
  waste_dump: "clear the site and provide a bin or collection point nearby",
  no_bin: "state that no waste bin or collection point lies within 3 km of this site, then ask to place waste bins here and arrange regular collection",
  contaminated_water: "clean the water and drains here and check the source of contamination",
  open_construction: "cover or remove the debris and enforce dust control measures",
};

const RULES = [
  "You draft a short, polite, neutral letter that a resident in India will file with a public office about a waste site.",
  "Use only the facts given. Never invent dates, numbers, names, places, rules or deadlines.",
  "Address the office in `to` by its office title only, and end with one sentence copying each `cc` office for attention.",
  "Never name or describe any person, never blame anyone, never mention a political party, and never use the words illegal or culprit.",
  "Quote every rule in `citations` exactly as given, character for character, inside straight double quotes.",
  "Give each citation its own short paragraph: its document and clause, then the quote.",
  "Do not add a signature, a name or a placeholder for one; the resident signs.",
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

  user(): string {
    const { site, addressees, citations } = this.#brief;
    const facts = {
      site_id: site.siteId,
      report_type: site.reportType,
      context: site.context,
      burning_seen: site.burning,
      place: site.place.name(),
      ...site.evidence,
      to: addressees.to,
      cc: addressees.cc.map((line) => ({ office: line.office, seat: line.seat.name, marking: line.marking })),
      citations: citations.map(({ document, clause, quote }) => ({ document, clause, quote })),
      request: REQUEST[site.reportType],
    };
    return JSON.stringify(facts, null, 2);
  }
}
