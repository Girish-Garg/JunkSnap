import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { ConfigError, InternalDataError } from "../domain/errors.js";
import type { AssetReader } from "../ports/AssetReader.js";

export class FileAssetReader implements AssetReader {
  readonly #root: string;

  constructor(root: string) {
    this.#root = resolve(root);
  }

  async readBytes(path: string): Promise<Uint8Array> {
    const file = this.#inside(path);
    try {
      return await readFile(file);
    } catch (error) {
      const hint = "set ASSETS_DIR to the folder that holds the repo's data/ files";
      throw new ConfigError(`cannot read asset ${path} under ${this.#root}: ${hint}`, { cause: error });
    }
  }

  // TextDecoder drops a UTF-8 byte order mark, which JSON.parse would reject.
  async readText(path: string): Promise<string> {
    return new TextDecoder().decode(await this.readBytes(path));
  }

  async readJson(path: string): Promise<unknown> {
    const text = await this.readText(path);
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new InternalDataError(`asset ${path} is not valid JSON`, { cause: error });
    }
  }

  #inside(path: string): string {
    const file = resolve(this.#root, path);
    const fromRoot = relative(this.#root, file);
    if (fromRoot === "" || fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
      throw new InternalDataError(`asset path ${path} is not a file under the assets folder`);
    }
    return file;
  }
}
