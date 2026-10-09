import { existsSync } from "node:fs";
import { cp, rm } from "node:fs/promises";

// Copies the repo's data folders into backend/server/assets/ (git-ignored) so docker build can COPY them.
const DATA_DIR = new URL("../../../data/", import.meta.url);
const ASSETS_DIR = new URL("../assets/", import.meta.url);
const FOLDERS = ["boundaries", "representatives", "brands", "rules", "wards"] as const;

async function main(): Promise<void> {
  await rm(ASSETS_DIR, { recursive: true, force: true });
  for (const folder of FOLDERS) {
    const source = new URL(`${folder}/`, DATA_DIR);
    if (!existsSync(source)) {
      console.log(`skipped data/${folder}: not in this checkout`);
      continue;
    }
    await cp(source, new URL(`${folder}/`, ASSETS_DIR), { recursive: true });
    console.log(`copied data/${folder} to assets/${folder}`);
  }
}

await main();
