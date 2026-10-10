import { readFile } from "node:fs/promises";
import { InternalDataError } from "../../domain/errors.js";

// Reads one local ward city file as JSON; TextDecoder drops a UTF-8 byte order mark, which JSON.parse would reject.
export async function readWardFile(path: string): Promise<unknown> {
  let text: string;
  try {
    text = new TextDecoder().decode(await readFile(path));
  } catch (error) {
    throw new InternalDataError(`cannot read ward file ${path}`, { cause: error });
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new InternalDataError(`ward file ${path} is not JSON`, { cause: error });
  }
}
