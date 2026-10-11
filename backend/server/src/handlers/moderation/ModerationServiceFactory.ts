import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { S3Client } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoCleanupHashIndex } from "../../adapters/moderation/DynamoCleanupHashIndex.js";
import { DynamoHashIndex } from "../../adapters/moderation/DynamoHashIndex.js";
import { DynamoReader } from "../../adapters/moderation/DynamoReader.js";
import { NoWasteLocator } from "../../adapters/moderation/NoWasteLocator.js";
import { RekognitionFaceFinder } from "../../adapters/moderation/RekognitionFaceFinder.js";
import { RekognitionImageModerator } from "../../adapters/moderation/RekognitionImageModerator.js";
import { RekognitionPlateFinder } from "../../adapters/moderation/RekognitionPlateFinder.js";
import { RekognitionSubjectFinder } from "../../adapters/moderation/RekognitionSubjectFinder.js";
import { S3ImageStore } from "../../adapters/moderation/S3ImageStore.js";
import { SharpBlurrer } from "../../adapters/moderation/SharpBlurrer.js";
import { SharpImageCodec } from "../../adapters/moderation/SharpImageCodec.js";
import { SystemClock } from "../../adapters/moderation/SystemClock.js";
import { TurfGeofence } from "../../adapters/moderation/TurfGeofence.js";
import type { DeviceRegistry } from "../../ports/moderation/DeviceRegistry.js";
import type { WasteLocator } from "../../ports/moderation/WasteLocator.js";
import { AuthenticityService } from "../../services/moderation/AuthenticityService.js";
import { CheckFactory } from "../../services/moderation/CheckFactory.js";
import { LlmNoteModerator, type NoteRouter } from "../../services/moderation/LlmNoteModerator.js";
import { ModerationService } from "../../services/moderation/ModerationService.js";
import { PhotoLoader } from "../../services/moderation/PhotoLoader.js";
import { PrivacyBlur } from "../../services/moderation/PrivacyBlur.js";
import { ModerationSettings } from "../../settings/ModerationSettings.js";
import type { EntryContext } from "../EntryPoint.js";
import { AWS_TIMEOUTS, awsClientConfig } from "../utils.js";
import { NoteRouterBuilder } from "./NoteRouterBuilder.js";

// About 2 km: absorbs the outline's 500 m simplification and GPS drift at coasts and borders.
export const INDIA_BUFFER_DEG = 0.02;

export interface ModerationWiring {
  readonly devices: DeviceRegistry;
  // Bedrock only: build it with NoteRouterBuilder, never the shared LLM router.
  readonly noteRouter: NoteRouter;
  // Defaults to NoWasteLocator until the trained detector's waste boxes land (issue 50).
  readonly waste?: WasteLocator;
}

// Builds the moderation object graph once per worker process.
export class ModerationServiceFactory {
  readonly #settings: ModerationSettings;

  constructor(settings: ModerationSettings) {
    this.#settings = settings;
  }

  // For the worker's entry point: reads settings when called, never at import.
  static forWorker(context: EntryContext, devices: DeviceRegistry): ModerationService {
    const factory = new ModerationServiceFactory(ModerationSettings.fromEnv(context.env));
    const bedrock = new BedrockRuntimeClient({ region: context.settings.awsRegion });
    return factory.create({ devices, noteRouter: new NoteRouterBuilder(bedrock).build(context.logger) });
  }

  create(wiring: ModerationWiring): ModerationService {
    const settings = this.#settings;
    const rekognition = new RekognitionClient(awsClientConfig(settings.awsRegion, AWS_TIMEOUTS.wait));
    const store = new S3ImageStore(new S3Client(awsClientConfig(settings.awsRegion, AWS_TIMEOUTS.transfer)), {
      originals: settings.originalsBucket,
      public: settings.publicBucket,
    });
    return new ModerationService({
      loader: new PhotoLoader(store, new SharpImageCodec()),
      gate: new RekognitionImageModerator(rekognition),
      waste: wiring.waste ?? new NoWasteLocator(),
      blur: new PrivacyBlur({
        faces: new RekognitionFaceFinder(rekognition),
        plates: new RekognitionPlateFinder(rekognition),
        subjects: new RekognitionSubjectFinder(rekognition),
        blurrer: new SharpBlurrer(),
        store,
      }),
      authenticity: new AuthenticityService(this.#checks(wiring.devices)),
      notes: new LlmNoteModerator(wiring.noteRouter),
      clock: new SystemClock(),
    });
  }

  #checks(devices: DeviceRegistry): CheckFactory {
    const settings = this.#settings;
    const reader = new DynamoReader(DynamoDBDocumentClient.from(new DynamoDBClient(awsClientConfig(settings.awsRegion))));
    return new CheckFactory({
      india: TurfGeofence.fromFile(settings.indiaOutlinePath(), INDIA_BUFFER_DEG),
      reportHashes: new DynamoHashIndex(reader, { reports: settings.reportsTable, sites: settings.sitesTable }),
      cleanupHashes: new DynamoCleanupHashIndex(reader, settings.cleanupsTable),
      devices,
    });
  }
}
