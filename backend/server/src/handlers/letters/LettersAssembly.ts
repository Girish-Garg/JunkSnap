import { AssetFiles } from "../../adapters/letters/AssetFiles.js";
import { RoutingRepository } from "../../adapters/letters/RoutingRepository.js";
import { RuleRepository } from "../../adapters/letters/RuleRepository.js";
import { ConfigError } from "../../domain/errors.js";
import type { Logger } from "../../ports/Logger.js";
import type { LetterStamp } from "../../ports/letters/LetterStamp.js";
import type { LetterWriter } from "../../ports/letters/LetterWriter.js";
import type { SiteReader } from "../../ports/letters/SiteReader.js";
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

export interface LettersAdapters {
  readonly sites: SiteReader;
  readonly counters: LetterCounters;
  readonly writer: LetterWriter;
  readonly stamp: LetterStamp;
}

// Loads the rule book once at startup and refuses to start if any stored quote fails the verifier.
export class LettersAssembly {
  readonly #rulesDir: string;
  readonly #logger: Logger;

  constructor(rulesDir: string, logger: Logger) {
    this.#rulesDir = rulesDir;
    this.#logger = logger;
  }

  async service(adapters: LettersAdapters): Promise<LetterService> {
    const files = new AssetFiles(this.#rulesDir);
    const book = await new RuleRepository(files).load();
    const routing = await new RoutingRepository(files).load();
    const quotes = new QuoteVerifier(book);
    LettersAssembly.#audit(quotes);
    const template = new TemplateLetter([new EnglishWording(), new HindiWording()]);
    return new LetterService({
      sites: adapters.sites,
      router: new LetterRouter(routing),
      picker: new ClausePicker(book),
      quotes,
      limiter: new LetterRateLimiter(adapters.counters),
      drafter: new ProseDrafter(adapters.writer, new DraftVerifier(quotes, book), template, this.#logger),
      stamp: adapters.stamp,
    });
  }

  static #audit(quotes: QuoteVerifier): void {
    const failed = quotes.unverifiedRules().map((rule) => rule.ruleId);
    if (failed.length > 0) {
      throw new ConfigError(`Quotes not found word for word on their page: ${failed.join(", ")}`);
    }
  }
}
