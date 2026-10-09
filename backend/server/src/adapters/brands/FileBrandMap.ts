import { readFile } from "node:fs/promises";
import { z } from "zod";
import { BrandAlias } from "../../domain/brands/BrandAlias.js";
import { BrandEntry } from "../../domain/brands/BrandEntry.js";
import { ConfigError } from "../../domain/errors.js";
import type { BrandMap } from "../../ports/brands/BrandMap.js";

const BrandFile = z.object({
  brands: z.array(
    z.object({
      brand: z.string().min(1),
      aliases: z.array(z.object({ text: z.string().min(1), require_exact: z.boolean() })).min(1),
      parent_company: z.string().min(1),
      source_url: z.url(),
    }),
  ),
});

type BrandRow = z.infer<typeof BrandFile>["brands"][number];

// Reads data/brands/brands.json once; a missing or malformed file is a deployment error.
export class FileBrandMap implements BrandMap {
  readonly #path: string;
  #entries: Promise<readonly BrandEntry[]> | undefined;

  constructor(path: string) {
    this.#path = path;
  }

  entries(): Promise<readonly BrandEntry[]> {
    this.#entries ??= this.#load();
    return this.#entries;
  }

  async #load(): Promise<readonly BrandEntry[]> {
    const text = await readFile(this.#path, "utf8").catch((error: unknown) => {
      throw new ConfigError(`cannot read the brand map at ${this.#path}`, { cause: error });
    });
    const parsed = BrandFile.safeParse(this.#json(text));
    if (!parsed.success) {
      throw new ConfigError(`brand map ${this.#path}: ${z.prettifyError(parsed.error)}`);
    }
    return parsed.data.brands.map((row) => FileBrandMap.#entry(row));
  }

  #json(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new ConfigError(`brand map ${this.#path} is not JSON`, { cause: error });
    }
  }

  static #entry(row: BrandRow): BrandEntry {
    return new BrandEntry({
      brand: row.brand,
      parentCompany: row.parent_company,
      sourceUrl: row.source_url,
      aliases: row.aliases.map((alias) => new BrandAlias(alias.text, alias.require_exact)),
    });
  }
}
