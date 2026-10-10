import type { AreaIssue } from "../../domain/letters/AreaIssueSites.js";
import type { Language } from "../../domain/letters/types.js";
import type { AreaLetterBrief } from "../../ports/letters/AreaLetterWriter.js";

const LANGUAGES: Readonly<Record<Language, string>> = { en: "English", hi: "Hindi in Devanagari script" };

const REQUEST: Readonly<Record<AreaIssue, string>> = {
  waste_dump: "clear these sites and provide bins or collection points where they are missing",
  no_bin: "place waste bins and arrange regular collection at these places",
  contaminated_water: "clean the water and drains at these sites and check the sources of contamination",
  open_construction: "cover or remove the debris at these sites and enforce dust control measures",
  overflowing_bin: "empty these bins regularly and repair or replace them",
  all: "clear the reported sites and address the causes behind them",
};

const RULES = [
  "You draft a short, polite, neutral letter that a resident in India will file with public offices about waste sites in one area.",
  "Use only the facts given: the counts, dates, sites, scores and bin access. Never invent dates, numbers, names, places, rules or deadlines.",
  "Address every office in `to` by its office title only, and end with one sentence copying each `cc` office for attention.",
  "Never name or describe any person, never blame anyone, never mention a political party, and never use the words illegal or culprit.",
  "Name the worst sites by their site id with their counts, dates and measured insights; photo_urls is only how many blurred photos the app shows beside the letter.",
  "Quote every rule in `citations` exactly as given, character for character, inside straight double quotes.",
  "Give each citation its own short paragraph: its document and clause, then the quote.",
  "Do not add a signature, a name or a placeholder for one; the resident signs.",
  "If residents_report is given, add one sentence in your own words on what residents report and at how many sites; never quote residents.",
  "Keep the quotes in English even when the letter is in another language.",
  "Use quotation marks for nothing else: not around document names, clauses, ids, places or the subject.",
  "Ask for the action in `request` and keep the body under 350 words. Keep the subject under 150 characters.",
  'Reply with one JSON object {"subject": string, "body": string} and nothing else.',
];

// The model gets only code-picked facts, addressees and citations for the area; it never picks a rule.
export class AreaLetterPrompt {
  readonly #brief: AreaLetterBrief;

  constructor(brief: AreaLetterBrief) {
    this.#brief = brief;
  }

  system(): string {
    return [...RULES, `Write the subject and the prose in ${LANGUAGES[this.#brief.language]}.`].join("\n");
  }

  user(): string {
    const { area, issue, addressees, citations, evidence } = this.#brief;
    const facts = {
      area,
      issue,
      counts: {
        reports: evidence.reports,
        reporters: evidence.reporters,
        verified_reports: evidence.verified_reports,
        sites: evidence.sites,
        first_reported_at: evidence.first_reported_at,
        last_reported_at: evidence.last_reported_at,
      },
      worst_sites: evidence.worst_sites.map((site) => ({ ...site, photo_urls: site.photo_urls.length })),
      measured_scores: evidence.scores,
      bin_access: evidence.bin_access,
      residents_report: evidence.residents ?? null,
      to: addressees.to,
      cc: addressees.cc.map((line) => ({ office: line.office, seat: line.seat.name, marking: line.marking })),
      citations: citations.map(({ document, clause, quote }) => ({ document, clause, quote })),
      request: REQUEST[issue],
    };
    return JSON.stringify(facts, null, 2);
  }
}
