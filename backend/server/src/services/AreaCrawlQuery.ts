import type { AreaCrawl } from "../contracts/index.gen.js";
import { ValidationError } from "../domain/errors.js";
import type { CrawlStatusReader } from "../ports/CrawlStatusReader.js";

const DISTRICT_ID = /^[a-z0-9-]{1,64}$/;

// GET /areas/district/{id}/crawl: any well-formed district id answers, not_started when it has no crawl yet.
export class AreaCrawlQuery {
  readonly #reader: CrawlStatusReader;

  constructor(reader: CrawlStatusReader) {
    this.#reader = reader;
  }

  async find(districtId: string): Promise<AreaCrawl> {
    if (!DISTRICT_ID.test(districtId)) {
      throw new ValidationError("id must be 1 to 64 characters of a-z, 0-9 and -");
    }
    return this.#reader.get(districtId);
  }
}
