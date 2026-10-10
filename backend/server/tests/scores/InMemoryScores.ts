import { validateWardScores, type WardScores } from "../../src/contracts/index.gen.js";
import type { ComputedAreaScores } from "../../src/domain/AreaInsights.js";
import type { AreaKey, AreaKind } from "../../src/domain/AreaKey.js";
import type { ScoreLister } from "../../src/ports/ScoreLister.js";
import type { ScoreRepository } from "../../src/ports/ScoreRepository.js";

interface Stored {
  readonly row: WardScores;
  readonly within: readonly string[];
}

// Validates like the Dynamo adapters and lists in insertion order, so ranking is the service's job.
export class InMemoryScores implements ScoreRepository, ScoreLister {
  readonly #rows = new Map<string, Stored>();
  readonly listed: string[] = [];

  async save(row: ComputedAreaScores | WardScores, within: readonly string[] = ["rajasthan-jodhpur"]): Promise<void> {
    this.#rows.set(`${row.area.kind}:${row.area.id}`, { row: validateWardScores(row), within });
  }

  async find(area: AreaKey): Promise<WardScores | null> {
    return this.#rows.get(area.toString())?.row ?? null;
  }

  async listWithin(kind: AreaKind, within: string): Promise<WardScores[]> {
    this.listed.push(`${kind} ${within}`);
    const stored = [...this.#rows.values()];
    return stored.filter((item) => item.row.area.kind === kind && item.within.includes(within)).map((item) => item.row);
  }
}
