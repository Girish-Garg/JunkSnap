import type { AreaLetterDraft, WardScores } from "../../contracts/index.gen.js";
import type { AreaKey } from "../../domain/AreaKey.js";
import { AreaNotFoundError } from "../../domain/AreaNotFoundError.js";
import { InternalDataError } from "../../domain/errors.js";
import { AreaIssueSites, type AreaIssue } from "../../domain/letters/AreaIssueSites.js";
import { AreaLetterEvidence } from "../../domain/letters/AreaLetterEvidence.js";
import { NotVerifiedError } from "../../domain/letters/errors.js";
import type { Rule } from "../../domain/letters/Rule.js";
import { Situation } from "../../domain/letters/Situation.js";
import type { Citation, Language, Requester } from "../../domain/letters/types.js";
import type { Logger } from "../../ports/Logger.js";
import type { AreaLetterBrief } from "../../ports/letters/AreaLetterWriter.js";
import type { AreaLetterSites } from "../../ports/letters/AreaLetterSites.js";
import type { LetterStamp } from "../../ports/letters/LetterStamp.js";
import type { AreaLetterRouter } from "./AreaLetterRouter.js";
import type { ClausePicker } from "./ClausePicker.js";
import type { LetterRateLimiter } from "./LetterRateLimiter.js";
import type { DraftedProse, ProseDrafter } from "./ProseDrafter.js";
import type { QuoteVerifier } from "./QuoteVerifier.js";

// The area page's guardrail (ward_scores.min_verified_reports).
const MIN_VERIFIED_REPORTS = 10;
const MAX_CLAUSES = 4;

export interface AreaLetterRequest {
  readonly area: AreaKey;
  readonly issue: AreaIssue;
  readonly language: Language;
  readonly requester: Requester;
}

export interface AreaLetterParts {
  readonly sites: AreaLetterSites;
  readonly scores: { find(area: AreaKey): Promise<WardScores | null> };
  readonly router: AreaLetterRouter;
  readonly picker: ClausePicker;
  readonly quotes: QuoteVerifier;
  readonly limiter: LetterRateLimiter;
  readonly drafter: ProseDrafter<AreaLetterBrief>;
  readonly stamp: LetterStamp;
  readonly logger: Logger;
  // NO_BIN_MIN_REPORTERS: a no-bin site counts only with this many distinct reporters.
}

type NonEmpty<T> = [T, ...T[]];

export class AreaLetterService {
  readonly #parts: AreaLetterParts;

  constructor(parts: AreaLetterParts) {
    this.#parts = parts;
  }

  async draft(request: AreaLetterRequest): Promise<AreaLetterDraft> {
    const { router, limiter, drafter, stamp } = this.#parts;
    await limiter.fits(request.requester, stamp.now());
    const sites = await this.#eligibleSites(request);
    const letterSites = sites.letterSites();
    const addressees = router.route(request.area, letterSites);
    const rules = this.#rules(request.area, Situation.combined(letterSites.map((site) => site.situation())));
    const citations = this.#verifiedCitations(rules);
    const evidence = new AreaLetterEvidence(sites, await this.#parts.scores.find(request.area)).section();
    const now = stamp.now();
    await limiter.take(request.requester, now);
    const area = { kind: request.area.kind, id: request.area.id, name: sites.name() };
    const brief: AreaLetterBrief = { area, issue: request.issue, addressees, citations, language: request.language, evidence };
    const prose = await drafter.draft(brief, rules);
    return this.#letter(brief, prose, now);
  }

  #letter(brief: AreaLetterBrief, prose: DraftedProse, now: Date): AreaLetterDraft {
    const citations = AreaLetterService.#nonEmpty(brief.citations, "a verified citation");
    return {
      letter_id: this.#parts.stamp.letterId(),
      area: brief.area,
      issue: brief.issue,
      to: AreaLetterService.#nonEmpty(brief.addressees.to.map((recipient) => ({ ...recipient })), "an addressee"),
      cc: brief.addressees.cc.map((line) => ({ ...line, seat: { ...line.seat } })),
      subject: prose.subject,
      body: prose.body,
      language: brief.language,
      citations,
      verifier: { verified: citations.length, total: citations.length },
      template_fallback: prose.templateFallback,
      ...prose.provenance,
      created_at: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
      evidence: brief.evidence,
    };
  }

  async #eligibleSites(request: AreaLetterRequest): Promise<AreaIssueSites> {
    const batch = await this.#parts.sites.sitesIn(request.area);
    if (batch.unreadable > 0) {
      this.#parts.logger.warn({ area: request.area.toString(), unreadable: batch.unreadable }, "skipped sites that break the site contract");
    }
    const sites = new AreaIssueSites(request.area, request.issue, batch.sites);
    if (!sites.hasSites()) {
      throw new AreaNotFoundError(`No reported sites in ${request.area.kind} ${request.area.id} yet`);
    }
    const verified = sites.verifiedReports();
    if (verified < MIN_VERIFIED_REPORTS) {
      const left = sites.noBinExclusions();
      const why = left.length === 0 ? "" : ` No-bin sites left out: ${left.join("; ")}.`;
      throw new NotVerifiedError(`Not enough verified reports yet (${verified} of ${MIN_VERIFIED_REPORTS}) for this issue in this area.${why}`);
    }
    return sites;
  }

  #rules(area: AreaKey, situation: Situation): Rule[] {
    const picked = this.#parts.router.channels(area).flatMap((channel) => this.#parts.picker.pickFor(channel, situation));
    return [...new Set(picked)].slice(0, MAX_CLAUSES);
  }

  // Never ship an unverified quote: anything short of verified N of N is our data bug.
  #verifiedCitations(rules: readonly Rule[]): readonly Citation[] {
    const checked = this.#parts.quotes.check(rules);
    if (checked.citations.length === 0 || checked.verified !== checked.total) {
      throw new InternalDataError(`Quote verifier passed ${checked.verified} of ${checked.total} picked rules`);
    }
    return checked.citations;
  }

  static #nonEmpty<T>(items: readonly T[], what: string): NonEmpty<T> {
    const [first, ...rest] = items;
    if (first === undefined) {
      throw new InternalDataError(`An area letter needs ${what}`);
    }
    return [first, ...rest];
  }
}
