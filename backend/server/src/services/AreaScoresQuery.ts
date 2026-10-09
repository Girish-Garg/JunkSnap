import type { AreaScoresRow } from "../domain/AreaInsights.js";
import { AreaKey } from "../domain/AreaKey.js";
import { AreaNotFoundError } from "../domain/AreaNotFoundError.js";
import type { ScoreRepository } from "../ports/ScoreRepository.js";

// The worker seeds a row when an area gets its first site, so no row means no sites.
export class AreaScoresQuery {
  readonly #scores: ScoreRepository;

  constructor(scores: ScoreRepository) {
    this.#scores = scores;
  }

  async find(kind: string, id: string): Promise<AreaScoresRow> {
    const area = AreaKey.parse(kind, id);
    const row = await this.#scores.find(area);
    if (row === null) {
      throw new AreaNotFoundError(`No reported sites in ${area.kind} ${area.id} yet`);
    }
    return row;
  }
}
