import type { WardScores } from "../contracts/index.gen.js";
import type { AreaKind } from "../domain/AreaKey.js";
import { AreaListRequest, type AreaListLimits, type AreaListParams } from "../domain/AreaListRequest.js";
import { AreaRanking } from "../domain/AreaRanking.js";
import type { ScoreLister } from "../ports/ScoreLister.js";

// The area_list body; each item is a stored ward_scores row, returned as stored.
export interface RankedAreas {
  readonly kind: AreaKind;
  readonly within: string;
  readonly total: number;
  readonly limit: number;
  readonly areas: readonly WardScores[];
}

// GET /areas/{kind}: ranks the city's areas; an empty list, never a 404, when none has a site yet.
export class AreaListQuery {
  readonly #scores: ScoreLister;
  readonly #limits: AreaListLimits;

  constructor(scores: ScoreLister, limits: AreaListLimits) {
    this.#scores = scores;
    this.#limits = limits;
  }

  async list(params: AreaListParams): Promise<RankedAreas> {
    const request = AreaListRequest.parse(params, this.#limits);
    const ranking = new AreaRanking(await this.#scores.listWithin(request.kind, request.within));
    const { kind, within, limit } = request;
    return { kind, within, total: ranking.total, limit, areas: ranking.top(limit) };
  }
}
