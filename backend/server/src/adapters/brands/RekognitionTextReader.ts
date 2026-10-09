import {
  DetectTextCommand,
  type BoundingBox,
  type DetectTextCommandOutput,
  type TextDetection,
} from "@aws-sdk/client-rekognition";
import type { BlurredImage } from "../../domain/brands/BlurredImage.js";
import { Box } from "../../domain/brands/Box.js";
import type { TextLine, TextReading, TextWord } from "../../domain/brands/TextReading.js";
import { ExternalServiceError } from "../../domain/errors.js";
import type { TextReader } from "../../ports/brands/TextReader.js";
import type { RekognitionImageSource } from "./RekognitionImageSource.js";

export interface DetectTextClient {
  send(command: DetectTextCommand): Promise<DetectTextCommandOutput>;
}

// DetectText reads Latin script only, up to 100 words; Confidence and boxes come back as 0-100 and fractions.
export class RekognitionTextReader implements TextReader {
  readonly #client: DetectTextClient;
  readonly #images: RekognitionImageSource;

  constructor(client: DetectTextClient, images: RekognitionImageSource) {
    this.#client = client;
    this.#images = images;
  }

  async read(image: BlurredImage): Promise<TextReading> {
    const command = new DetectTextCommand({ Image: await this.#images.imageFor(image) });
    const output = await this.#client.send(command).catch((error: unknown) => {
      throw new ExternalServiceError("Rekognition DetectText failed", { cause: error });
    });
    if (output.TextModelVersion === undefined) {
      throw new ExternalServiceError("Rekognition DetectText returned no model version");
    }
    const source = { provider: "rekognition", model: "DetectText", version: output.TextModelVersion } as const;
    return { lines: this.#lines(output.TextDetections ?? []), source };
  }

  #lines(detections: readonly TextDetection[]): TextLine[] {
    const words = detections.filter((detection) => detection.Type === "WORD");
    return detections
      .filter((detection) => detection.Type === "LINE")
      .map((line) => ({
        text: line.DetectedText ?? "",
        confidence: (line.Confidence ?? 0) / 100,
        words: words.filter((word) => word.ParentId === line.Id).map((word) => this.#word(word)),
      }));
  }

  #word(detection: TextDetection): TextWord {
    return {
      text: detection.DetectedText ?? "",
      confidence: (detection.Confidence ?? 0) / 100,
      box: this.#box(detection.Geometry?.BoundingBox),
    };
  }

  #box(box: BoundingBox = {}): Box {
    const { Left = 0, Top = 0, Width = 0, Height = 0 } = box;
    return new Box({ left: Left, top: Top, width: Width, height: Height });
  }
}
