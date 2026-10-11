import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoPhotoFlagStore } from "../../adapters/flags/DynamoPhotoFlagStore.js";
import { DynamoLetterCounter, type CounterRetry } from "../../adapters/letters/DynamoLetterCounter.js";
import type { CommunityTrigger } from "../../ports/flags/PhotoFlagStore.js";
import type { Logger } from "../../ports/Logger.js";
import type { NoteModerator } from "../../ports/moderation/NoteModerator.js";
import { PhotoFlagService } from "../../services/flags/PhotoFlagService.js";
import { LetterRateLimiter } from "../../services/letters/LetterRateLimiter.js";
import type { NotesSettings } from "../../settings/NotesSettings.js";
import { PagingSettings } from "../../settings/PagingSettings.js";
import { RateLimitSettings } from "../../settings/RateLimitSettings.js";
import { RetrySettings } from "../../settings/RetrySettings.js";
import type { Env } from "../../settings/utils.js";
import type { FlagSiteParts } from "../sites/SiteServiceFactory.js";

// The tunable numbers photo reports take, each read once from its variable.
export interface FlagTunables {
  // FLAGS_PER_HOUR.
  readonly perHour: number;
  readonly counter: CounterRetry;
  // NOTES_MAX_PAGES: photo report texts read for a site's community analysis.
  readonly maxTextPages: number;
}

export interface FlagChecks {
  readonly moderator: NoteModerator;
  readonly community: CommunityTrigger;
}

// Photo reports (decision 20261011-0310-hem-photo-flags): the notes table, the note moderator, and sites saved like votes.
export class PhotoFlagsAssembly {
  readonly #settings: NotesSettings;
  readonly #client: DynamoDBDocumentClient;
  readonly #logger: Logger;
  readonly #tunables: FlagTunables;

  constructor(settings: NotesSettings, client: DynamoDBDocumentClient, logger: Logger, tunables = PhotoFlagsAssembly.tunables({})) {
    this.#settings = settings;
    this.#client = client;
    this.#logger = logger;
    this.#tunables = tunables;
  }

  static tunables(env: Env): FlagTunables {
    const perHour = RateLimitSettings.fromEnv(env).flagsPerHour;
    return { perHour, counter: RetrySettings.fromEnv(env).counter, maxTextPages: PagingSettings.fromEnv(env).notesMaxPages };
  }

  store(): DynamoPhotoFlagStore {
    return new DynamoPhotoFlagStore(this.#client, this.#settings.notesTable, this.#tunables.maxTextPages);
  }

  service(site: FlagSiteParts, checks: FlagChecks): PhotoFlagService {
    const { devicesTable, usersTable } = this.#settings;
    const { counter, perHour } = this.#tunables;
    const counters = {
      devices: new DynamoLetterCounter(this.#client, { name: devicesTable, keyName: "device_token", prefix: "flag" }, counter),
      users: new DynamoLetterCounter(this.#client, { name: usersTable, keyName: "user_id", prefix: "flag" }, counter),
    };
    const limiter = new LetterRateLimiter(counters, this.#logger, perHour, "photo reports");
    return new PhotoFlagService({ ...site, ...checks, flags: this.store(), limiter });
  }
}
