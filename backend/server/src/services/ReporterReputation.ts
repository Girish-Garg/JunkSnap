import type { Reporter } from "../domain/ReportRecord.js";
import type { ReputationReader } from "../ports/ReputationReader.js";

// The lower of the user's and the device's reputation, per contracts/README.md.
export class ReporterReputation {
  readonly #reader: ReputationReader;

  constructor(reader: ReputationReader) {
    this.#reader = reader;
  }

  async of(reporter: Reporter): Promise<number> {
    const reads = [this.#reader.ofDevice(reporter.deviceToken)];
    if (reporter.userId !== undefined) {
      reads.push(this.#reader.ofUser(reporter.userId));
    }
    return Math.min(...(await Promise.all(reads)));
  }
}
