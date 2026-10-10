import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoPhotoFlagStore } from "../../adapters/flags/DynamoPhotoFlagStore.js";
import { DynamoLetterCounter } from "../../adapters/letters/DynamoLetterCounter.js";
import { FLAGS_PER_HOUR } from "../../domain/flags/PhotoFlagPolicy.js";
import type { CommunityTrigger } from "../../ports/flags/PhotoFlagStore.js";
import type { NoteModerator } from "../../ports/moderation/NoteModerator.js";
import { PhotoFlagService } from "../../services/flags/PhotoFlagService.js";
import { LetterRateLimiter } from "../../services/letters/LetterRateLimiter.js";
import type { NotesSettings } from "../../settings/NotesSettings.js";
import type { FlagSiteParts } from "../sites/SiteServiceFactory.js";

export interface FlagChecks {
  readonly moderator: NoteModerator;
  readonly community: CommunityTrigger;
}

// Photo reports (decision 20261011-0310-hem-photo-flags): the notes table, the note moderator, and sites saved like votes.
export class PhotoFlagsAssembly {
  readonly #settings: NotesSettings;
  readonly #client: DynamoDBDocumentClient;

  constructor(settings: NotesSettings, client: DynamoDBDocumentClient) {
    this.#settings = settings;
    this.#client = client;
  }

  store(): DynamoPhotoFlagStore {
    return new DynamoPhotoFlagStore(this.#client, this.#settings.notesTable);
  }

  service(site: FlagSiteParts, checks: FlagChecks): PhotoFlagService {
    const { devicesTable, usersTable } = this.#settings;
    const counters = {
      devices: new DynamoLetterCounter(this.#client, { name: devicesTable, keyName: "device_token", prefix: "flag" }),
      users: new DynamoLetterCounter(this.#client, { name: usersTable, keyName: "user_id", prefix: "flag" }),
    };
    const limiter = new LetterRateLimiter(counters, FLAGS_PER_HOUR, "photo reports");
    return new PhotoFlagService({ ...site, ...checks, flags: this.store(), limiter });
  }
}
