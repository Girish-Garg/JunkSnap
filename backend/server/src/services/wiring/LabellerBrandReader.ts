import type { BrandLabel } from "../../contracts/index.gen.js";
import { BlurredImage } from "../../domain/brands/BlurredImage.js";
import type { BrandReader, BrandReadRequest } from "../../ports/BrandReader.js";
import type { BrandLabeller } from "../brands/BrandLabeller.js";

// The brands step reads only the public blurred copy, whose key the labeller derives from the report id.
export class LabellerBrandReader implements BrandReader {
  readonly #labeller: BrandLabeller;

  constructor(labeller: BrandLabeller) {
    this.#labeller = labeller;
  }

  read(request: BrandReadRequest): Promise<BrandLabel[]> {
    return this.#labeller.label(new BlurredImage(request.reportId));
  }
}
