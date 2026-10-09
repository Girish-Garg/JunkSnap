import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { S3Client } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoHashIndex } from "../../adapters/moderation/DynamoHashIndex.js";
import { PassThroughNoteModerator } from "../../adapters/moderation/PassThroughNoteModerator.js";
import { RekognitionFaceFinder } from "../../adapters/moderation/RekognitionFaceFinder.js";
import { RekognitionImageModerator } from "../../adapters/moderation/RekognitionImageModerator.js";
import { RekognitionPlateFinder } from "../../adapters/moderation/RekognitionPlateFinder.js";
import { S3ImageStore } from "../../adapters/moderation/S3ImageStore.js";
import { SharpBlurrer } from "../../adapters/moderation/SharpBlurrer.js";
import { SharpImageCodec } from "../../adapters/moderation/SharpImageCodec.js";
import { SystemClock } from "../../adapters/moderation/SystemClock.js";
import { TurfGeofence } from "../../adapters/moderation/TurfGeofence.js";
import type { DeviceRegistry } from "../../ports/moderation/DeviceRegistry.js";
import type { NoteModerator } from "../../ports/moderation/NoteModerator.js";
import { AuthenticityService } from "../../services/moderation/AuthenticityService.js";
import { CheckFactory } from "../../services/moderation/CheckFactory.js";
import { ModerationService } from "../../services/moderation/ModerationService.js";
import { PhotoLoader } from "../../services/moderation/PhotoLoader.js";
import { PrivacyBlur } from "../../services/moderation/PrivacyBlur.js";
import type { ModerationSettings } from "../../settings/ModerationSettings.js";

// About 2 km: absorbs the outline's 500 m simplification and GPS drift at coasts and borders.
export const INDIA_BUFFER_DEG = 0.02;

export interface ModerationWiring {
  readonly devices: DeviceRegistry;
  // Defaults to the pass-through stand-in.
  readonly notes?: NoteModerator;
}

// Builds the moderation object graph once per worker process.
export class ModerationServiceFactory {
  readonly #settings: ModerationSettings;

  constructor(settings: ModerationSettings) {
    this.#settings = settings;
  }

  create(wiring: ModerationWiring): ModerationService {
    const settings = this.#settings;
    const rekognition = new RekognitionClient({ region: settings.awsRegion });
    const store = new S3ImageStore(new S3Client({ region: settings.awsRegion }), {
      originals: settings.originalsBucket,
      public: settings.publicBucket,
    });
    return new ModerationService({
      loader: new PhotoLoader(store, new SharpImageCodec()),
      gate: new RekognitionImageModerator(rekognition),
      blur: new PrivacyBlur({
        faces: new RekognitionFaceFinder(rekognition),
        plates: new RekognitionPlateFinder(rekognition),
        blurrer: new SharpBlurrer(),
        store,
      }),
      authenticity: new AuthenticityService(this.#checks(wiring.devices)),
      notes: wiring.notes ?? new PassThroughNoteModerator(),
      clock: new SystemClock(),
    });
  }

  #checks(devices: DeviceRegistry): CheckFactory {
    const settings = this.#settings;
    const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: settings.awsRegion }));
    return new CheckFactory({
      india: TurfGeofence.fromFile(settings.indiaOutlinePath(), INDIA_BUFFER_DEG),
      hashes: new DynamoHashIndex(dynamo, { reports: settings.reportsTable, sites: settings.sitesTable }),
      devices,
    });
  }
}
