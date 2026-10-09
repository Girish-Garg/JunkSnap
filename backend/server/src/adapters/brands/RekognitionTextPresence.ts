import { DetectLabelsCommand, type DetectLabelsCommandOutput } from "@aws-sdk/client-rekognition";
import type { BlurredImage } from "../../domain/brands/BlurredImage.js";
import { ExternalServiceError } from "../../domain/errors.js";
import type { TextPresence } from "../../ports/brands/TextPresence.js";
import type { RekognitionImageSource } from "./RekognitionImageSource.js";

const TEXT_LABEL = "Text";
// Rendered Devanagari scored 80.9 to 94 as Text while DetectText read nothing (probe, 10 Oct 2026).
const MIN_CONFIDENCE = 75;

export interface DetectLabelsClient {
  send(command: DetectLabelsCommand): Promise<DetectLabelsCommandOutput>;
}

export class RekognitionTextPresence implements TextPresence {
  readonly #client: DetectLabelsClient;
  readonly #images: RekognitionImageSource;

  constructor(client: DetectLabelsClient, images: RekognitionImageSource) {
    this.#client = client;
    this.#images = images;
  }

  async hasText(image: BlurredImage): Promise<boolean> {
    const command = new DetectLabelsCommand({
      Image: await this.#images.imageFor(image),
      MinConfidence: MIN_CONFIDENCE,
      Features: ["GENERAL_LABELS"],
      Settings: { GeneralLabels: { LabelInclusionFilters: [TEXT_LABEL] } },
    });
    const output = await this.#client.send(command).catch((error: unknown) => {
      throw new ExternalServiceError("Rekognition DetectLabels failed", { cause: error });
    });
    return (output.Labels ?? []).some((label) => label.Name === TEXT_LABEL);
  }
}
