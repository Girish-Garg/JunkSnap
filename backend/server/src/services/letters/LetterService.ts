import type { LetterDraft } from "../../contracts/index.gen.js";
import { InternalDataError, NotFoundError } from "../../domain/errors.js";
import { LetterEvidence } from "../../domain/letters/LetterEvidence.js";
import { LetterSite } from "../../domain/letters/LetterSite.js";
import type { LetterStanding } from "../../domain/letters/LetterStanding.js";
import type { Rule } from "../../domain/letters/Rule.js";
import type { Addressees, Channel, Citation, Language, Requester } from "../../domain/letters/types.js";
import type { LetterBrief } from "../../ports/letters/LetterWriter.js";
import type { LetterStamp } from "../../ports/letters/LetterStamp.js";
import type { SiteReader } from "../../ports/letters/SiteReader.js";
import type { ClausePicker } from "./ClausePicker.js";
import type { LetterRateLimiter } from "./LetterRateLimiter.js";
import type { LetterRouter } from "./LetterRouter.js";
import type { DraftedProse, ProseDrafter } from "./ProseDrafter.js";
import type { QuoteVerifier } from "./QuoteVerifier.js";

export interface LetterRequest {
  readonly siteId: string;
  readonly channel: Channel;
  readonly language: Language;
  readonly requester: Requester;
}

export interface LetterServiceParts {
  readonly sites: SiteReader;
  readonly router: LetterRouter;
  readonly picker: ClausePicker;
  readonly quotes: QuoteVerifier;
  readonly limiter: LetterRateLimiter;
  readonly drafter: ProseDrafter;
  readonly stamp: LetterStamp;
  // Removed, rejected and expired sites take no letter; verified and unverified ones do.
  readonly standing: LetterStanding;
  // BIN_RADIUS_M, for the no-bin request line.
  readonly binRadiusM: number;
}

type NonEmpty<T> = [T, ...T[]];

export class LetterService {
  readonly #parts: LetterServiceParts;

  constructor(parts: LetterServiceParts) {
    this.#parts = parts;
  }

  async draft(request: LetterRequest): Promise<LetterDraft> {
    const { router, picker, limiter, drafter, stamp } = this.#parts;
    const site = await this.#standingSite(request.siteId);
    const addressees = router.route(request.channel, site);
    const rules = picker.pick(request.channel, site);
    const citations = this.#verifiedCitations(rules);
    const now = stamp.now();
    await limiter.take(request.requester, now);
    const brief: LetterBrief = { site, addressees, citations, language: request.language, binRadiusM: this.#parts.binRadiusM };
    const prose = await drafter.draft(brief, rules);
    return this.#letter(brief, citations, prose, now);
  }

  async #standingSite(siteId: string): Promise<LetterSite> {
    const stored = await this.#parts.sites.find(siteId);
    if (stored === null) {
      throw new NotFoundError(`No site ${siteId}`);
    }
    this.#parts.standing.check(stored.properties, this.#parts.stamp.now());
    return LetterSite.fromSite(stored);
  }

  // Never ship an unverified quote: anything short of verified N of N is our data bug.
  #verifiedCitations(rules: readonly Rule[]): NonEmpty<Citation> {
    const checked = this.#parts.quotes.check(rules);
    const [first, ...rest] = checked.citations;
    if (first === undefined || checked.verified !== checked.total) {
      throw new InternalDataError(`Quote verifier passed ${checked.verified} of ${checked.total} picked rules`);
    }
    return [first, ...rest];
  }

  #letter(brief: LetterBrief, citations: NonEmpty<Citation>, prose: DraftedProse, now: Date): LetterDraft {
    const { site, addressees, language } = brief;
    return {
      letter_id: this.#parts.stamp.letterId(),
      site_id: site.siteId,
      ...LetterService.#addressFields(addressees),
      subject: prose.subject,
      body: prose.body,
      language,
      citations,
      verifier: { verified: citations.length, total: citations.length },
      template_fallback: prose.templateFallback,
      ...prose.provenance,
      created_at: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
      evidence: new LetterEvidence(site).section(),
    };
  }

  static #addressFields(addressees: Addressees): Pick<LetterDraft, "channel" | "to" | "cc" | "filing_url"> {
    const { channel, to, cc, filingUrl } = addressees;
    return { channel, to: { ...to }, cc: cc.map((line) => ({ ...line, seat: { ...line.seat } })), filing_url: filingUrl };
  }
}
