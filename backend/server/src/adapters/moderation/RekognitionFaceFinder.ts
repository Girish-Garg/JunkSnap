import { DetectFacesCommand, type RekognitionClient } from "@aws-sdk/client-rekognition";
import type { FoundRegions } from "../../domain/moderation/types.js";
import type { FaceFinder } from "../../ports/moderation/FaceFinder.js";
import { callService, toBoxes } from "./utils.js";

// Every face Rekognition returns is blurred, however low its confidence.
export class RekognitionFaceFinder implements FaceFinder {
  readonly #client: RekognitionClient;

  constructor(client: RekognitionClient) {
    this.#client = client;
  }

  async find(jpeg: Uint8Array): Promise<FoundRegions> {
    const command = new DetectFacesCommand({ Image: { Bytes: jpeg } });
    const response = await callService("Rekognition DetectFaces", () => this.#client.send(command));
    const boxes = (response.FaceDetails ?? []).flatMap((face) => toBoxes(face.BoundingBox));
    return { boxes, model: "DetectFaces", version: null };
  }
}
