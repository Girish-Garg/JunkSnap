import { AssetFiles } from "../../adapters/letters/AssetFiles.js";
import { RoutingRepository } from "../../adapters/letters/RoutingRepository.js";
import { RuleRepository } from "../../adapters/letters/RuleRepository.js";
import { ConfigError } from "../../domain/errors.js";
import { LetterStanding } from "../../domain/letters/LetterStanding.js";
import type { RuleBook } from "../../domain/letters/RuleBook.js";
import type { AreaLetterBrief, AreaLetterWriter } from "../../ports/letters/AreaLetterWriter.js";
import type { AreaLetterSites } from "../../ports/letters/AreaLetterSites.js";
import { AreaEnglishWording } from "../../services/letters/AreaEnglishWording.js";
import { AreaHindiWording } from "../../services/letters/AreaHindiWording.js";
import { AreaLetterRouter } from "../../services/letters/AreaLetterRouter.js";
import { AreaLetterService, type AreaLetterParts } from "../../services/letters/AreaLetterService.js";
import { AreaTemplateLetter } from "../../services/letters/AreaTemplateLetter.js";
import type { Logger } from "../../ports/Logger.js";
import { BinSettings } from "../../settings/BinSettings.js";
import { RateLimitSettings } from "../../settings/RateLimitSettings.js";
import { ScoreSettings } from "../../settings/ScoreSettings.js";
import { SiteRuleSettings } from "../../settings/SiteRuleSettings.js";
import type { Env } from "../../settings/utils.js";
import type { LetterStamp } from "../../ports/letters/LetterStamp.js";
import type { LetterWriter } from "../../ports/letters/LetterWriter.js";
import type { SiteReader } from "../../ports/letters/SiteReader.js";
import { BackingClaimGuard } from "../../services/letters/BackingClaimGuard.js";
import { ClausePicker } from "../../services/letters/ClausePicker.js";
import { DraftVerifier } from "../../services/letters/DraftVerifier.js";
import { EnglishWording } from "../../services/letters/EnglishWording.js";
import { HindiWording } from "../../services/letters/HindiWording.js";
import { LetterRateLimiter, type LetterCounters } from "../../services/letters/LetterRateLimiter.js";
import { LetterRouter } from "../../services/letters/LetterRouter.js";
import { LetterService } from "../../services/letters/LetterService.js";
import { ProseDrafter } from "../../services/letters/ProseDrafter.js";
import { QuoteVerifier } from "../../services/letters/QuoteVerifier.js";
import { TemplateLetter } from "../../services/letters/TemplateLetter.js";
import { WordingCheck } from "../../services/letters/WordingCheck.js";

export interface LettersAdapters {
  readonly sites: SiteReader;
  readonly counters: LetterCounters;
  readonly writer: LetterWriter;
  readonly stamp: LetterStamp;
}

export interface AreaLettersAdapters {
  readonly sites: AreaLetterSites;
  readonly scores: AreaLetterParts["scores"];
  readonly counters: LetterCounters;
  readonly writer: AreaLetterWriter;
  readonly stamp: LetterStamp;
}

// The tunable numbers letters take, each read once from its variable.
export interface LetterTunables {
  readonly bins: BinSettings;
  // LETTERS_PER_HOUR, shared by site and area letters.
  readonly perHour: number;
  // SITE_TTL_DAYS: expired sites take no letter.
  readonly ttlDays: number;
  // MIN_VERIFIED_REPORTS: an area letter's guardrail.
  readonly minVerifiedReports: number;
}

export class LettersAssembly {
  readonly #rulesDir: string;
  readonly #logger: Logger;
  readonly #bins: BinSettings;
  readonly #tunables: LetterTunables;

  constructor(rulesDir: string, logger: Logger, tunables = LettersAssembly.tunables({})) {
    this.#rulesDir = rulesDir;
    this.#logger = logger;
    this.#bins = tunables.bins;
    this.#tunables = tunables;
  }

  static tunables(env: Env): LetterTunables {
    const bins = BinSettings.fromEnv(env);
    const { minVerifiedReports } = ScoreSettings.fromEnv(env);
    return { bins, perHour: RateLimitSettings.fromEnv(env).lettersPerHour, ttlDays: SiteRuleSettings.fromEnv(env).ttlDays, minVerifiedReports };
  }

  async service(adapters: LettersAdapters): Promise<LetterService> {
    const { book, quotes } = await this.#rules();
    const routing = await new RoutingRepository(new AssetFiles(this.#rulesDir)).load();
    const template = new TemplateLetter([new EnglishWording(this.#bins.radiusM), new HindiWording(this.#bins.radiusM)]);
    // Decision 20261011-1750: a model draft that calls an unverified site verified falls back to the template.
    const writer = new BackingClaimGuard(adapters.writer);
    return new LetterService({
      sites: adapters.sites,
      router: new LetterRouter(routing),
      picker: new ClausePicker(book),
      quotes,
      limiter: new LetterRateLimiter(adapters.counters, this.#logger, this.#tunables.perHour),
      drafter: new ProseDrafter(writer, new DraftVerifier(quotes, book, new WordingCheck()), template, this.#logger),
      stamp: adapters.stamp,
      standing: new LetterStanding(this.#tunables.ttlDays),
      binRadiusM: this.#bins.radiusM,
    });
  }

  async areaService(adapters: AreaLettersAdapters): Promise<AreaLetterService> {
    const { book, quotes } = await this.#rules();
    const radius = this.#bins.radiusM;
    const template = new AreaTemplateLetter([new AreaEnglishWording(radius), new AreaHindiWording(radius)]);
    const verifier = new DraftVerifier(quotes, book, new WordingCheck());
    return new AreaLetterService({
      sites: adapters.sites,
      scores: adapters.scores,
      router: new AreaLetterRouter(),
      picker: new ClausePicker(book),
      quotes,
      limiter: new LetterRateLimiter(adapters.counters, this.#logger, this.#tunables.perHour),
      drafter: new ProseDrafter<AreaLetterBrief>(adapters.writer, verifier, template, this.#logger),
      stamp: adapters.stamp,
      logger: this.#logger,
      rules: { minVerifiedReports: this.#tunables.minVerifiedReports, ttlDays: this.#tunables.ttlDays },
    });
  }

  async #rules(): Promise<{ book: RuleBook; quotes: QuoteVerifier }> {
    const book = await new RuleRepository(new AssetFiles(this.#rulesDir)).load();
    const quotes = new QuoteVerifier(book);
    LettersAssembly.#audit(quotes);
    return { book, quotes };
  }

  static #audit(quotes: QuoteVerifier): void {
    const failed = quotes.unverifiedRules().map((rule) => rule.ruleId);
    if (failed.length > 0) {
      throw new ConfigError(`Quotes not found word for word on their page: ${failed.join(", ")}`);
    }
  }
}
