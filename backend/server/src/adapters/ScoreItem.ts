import { validateWardScores, type WardScores } from "../contracts/index.gen.js";
import { InternalDataError } from "../domain/errors.js";

// Table-only attributes: the key, and `within` (district and local body ids of the area's sites, for the city list).
const TABLE_FIELDS = new Set(["area_kind", "area_id", "within"]);

// A scores-table item is the ward_scores body plus TABLE_FIELDS; every row passes the contract both ways.
export class ScoreItem {
  readonly #item: Record<string, unknown>;

  private constructor(item: Record<string, unknown>) {
    this.#item = item;
  }

  static of(row: object, within: readonly string[]): ScoreItem {
    const scores = ScoreItem.#checked(row);
    return new ScoreItem({ area_kind: scores.area.kind, area_id: scores.area.id, within: [...within], ...scores });
  }

  static read(item: Record<string, unknown>): ScoreItem {
    return new ScoreItem(item);
  }

  item(): Record<string, unknown> {
    return { ...this.#item };
  }

  body(): WardScores {
    return ScoreItem.#checked(Object.fromEntries(Object.entries(this.#item).filter(([field]) => !TABLE_FIELDS.has(field))));
  }

  static #checked(row: object): WardScores {
    try {
      return validateWardScores(row);
    } catch (error) {
      throw new InternalDataError("scores row breaks the ward_scores contract", { cause: error });
    }
  }
}
