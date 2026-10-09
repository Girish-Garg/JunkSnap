import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { ConfigError } from "../../domain/errors.js";

// Reads files under one folder of ASSETS_DIR; any missing or malformed file stops startup.
export class AssetFiles {
  readonly #dir: string;

  constructor(dir: string) {
    this.#dir = dir;
  }

  async bytes(name: string): Promise<Buffer> {
    const path = join(this.#dir, name);
    try {
      return await readFile(path);
    } catch (error) {
      throw new ConfigError(`Cannot read ${path}; check ASSETS_DIR`, { cause: error });
    }
  }

  async json<S extends z.ZodType>(name: string, schema: S): Promise<z.output<S>> {
    const text = (await this.bytes(name)).toString("utf8");
    const result = schema.safeParse(AssetFiles.#parse(name, text));
    if (!result.success) {
      throw new ConfigError(`${name}: ${z.prettifyError(result.error)}`);
    }
    return result.data;
  }

  static #parse(name: string, text: string): unknown {
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new ConfigError(`${name} is not valid JSON`, { cause: error });
    }
  }
}
