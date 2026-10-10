// Weights rank rules: a rule matching the context or a hazard is more specific than one matching the type.
const WEIGHTS = { context: 2, hazard: 2, reportType: 1, packaging: 1 } as const;

export interface SituationFacts {
  readonly reportType: string;
  readonly context: string;
  readonly burning: boolean;
  readonly hazards: readonly string[];
  readonly packaging: boolean;
}

export class Situation {
  readonly #weights: ReadonlyMap<string, number>;

  private constructor(weights: ReadonlyMap<string, number>) {
    this.#weights = weights;
  }

  static of(facts: SituationFacts): Situation {
    const weights = new Map<string, number>([
      [facts.reportType, WEIGHTS.reportType],
      [facts.context, WEIGHTS.context],
    ]);
    const hazards = facts.burning ? [...facts.hazards, "burning"] : facts.hazards;
    for (const hazard of hazards) {
      weights.set(hazard, WEIGHTS.hazard);
    }
    if (facts.packaging) {
      weights.set("packaging", WEIGHTS.packaging);
    }
    return new Situation(weights);
  }

  // An area letter covers several sites: each tag keeps its highest weight across them.
  static combined(situations: readonly Situation[]): Situation {
    const weights = new Map<string, number>();
    for (const [tag, weight] of situations.flatMap((situation) => [...situation.#weights])) {
      weights.set(tag, Math.max(weight, weights.get(tag) ?? 0));
    }
    return new Situation(weights);
  }

  weightOf(tag: string): number {
    return this.#weights.get(tag) ?? 0;
  }
}
