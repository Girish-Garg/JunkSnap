import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { GetObjectCommand, ListObjectsV2Command, type S3Client } from "@aws-sdk/client-s3";
import { z } from "zod";
import { ExternalServiceError } from "../../domain/errors.js";
import type { Logger } from "../../ports/Logger.js";
import type { WardFile, WardFileSource } from "../../ports/WardFileSource.js";

const PREFIX = "crawl/wards/";
// Only <city>.json directly under the prefix; the city names a local file, so it never holds a path separator.
const CITY_KEY = /^crawl\/wards\/([a-z0-9-]{1,64})\.json$/;
// Only the parts every reader needs; WardRecordAreaFacts and FileMapLayerSource check the rest.
const CityFile = z.object({ records: z.array(z.unknown()), map_layers: z.array(z.unknown()).nullish() });

// The crawler's crawl/wards/<city>.json in the originals bucket, downloaded to local disk; any S3 failure means none.
export class S3CrawledWardFiles implements WardFileSource {
  readonly #client: S3Client;
  readonly #bucket: string;
  readonly #downloadDir: string;
  readonly #logger: Logger;

  constructor(client: S3Client, bucket: string, downloadDir: string, logger: Logger) {
    this.#client = client;
    this.#bucket = bucket;
    this.#downloadDir = downloadDir;
    this.#logger = logger;
  }

  async files(): Promise<readonly WardFile[]> {
    try {
      const cities = await this.#cities();
      await mkdir(this.#downloadDir, { recursive: true });
      const files = await Promise.all(cities.map((city) => this.#download(city)));
      return files.filter((file) => file !== null);
    } catch (error) {
      this.#logger.warn({ error, prefix: PREFIX }, "crawled ward files unavailable; using the image's ward files");
      return [];
    }
  }

  async #cities(): Promise<string[]> {
    const cities: string[] = [];
    let token: string | undefined;
    do {
      const command = new ListObjectsV2Command({ Bucket: this.#bucket, Prefix: PREFIX, ContinuationToken: token });
      const page = await this.#client.send(command);
      const keys = (page.Contents ?? []).map((object) => object.Key ?? "");
      cities.push(...keys.flatMap((key) => CITY_KEY.exec(key)?.slice(1, 2) ?? []));
      token = page.IsTruncated === true ? page.NextContinuationToken : undefined;
    } while (token !== undefined);
    return cities.sort();
  }

  // A crawled file that is not a city file is skipped, so a bad crawl never stops the worker or the scores job.
  async #download(city: string): Promise<WardFile | null> {
    const key = `${PREFIX}${city}.json`;
    const output = await this.#client.send(new GetObjectCommand({ Bucket: this.#bucket, Key: key }));
    if (output.Body === undefined) {
      throw new ExternalServiceError(`S3 returned no body for ${key}`);
    }
    const bytes = await output.Body.transformToByteArray();
    if (!S3CrawledWardFiles.#isCityFile(bytes)) {
      this.#logger.warn({ key }, "skipped a crawled ward file that is not a city file");
      return null;
    }
    const path = join(this.#downloadDir, `${city}.json`);
    await writeFile(path, bytes);
    return { city, path };
  }

  static #isCityFile(bytes: Uint8Array): boolean {
    try {
      return CityFile.safeParse(JSON.parse(new TextDecoder().decode(bytes))).success;
    } catch {
      return false;
    }
  }
}
