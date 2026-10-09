import type { Report } from "../domain/Report.js";
import type { BrandReader } from "../ports/BrandReader.js";
import type { PipelineStep } from "../ports/PipelineStep.js";

export class BrandsStep implements PipelineStep {
  readonly name = "brands";
  readonly #reader: BrandReader;

  constructor(reader: BrandReader) {
    this.#reader = reader;
  }

  async run(report: Report): Promise<void> {
    report.recordBrands(await this.#reader.read({ reportId: report.id, blurredKey: report.blurredKey() }));
  }
}
