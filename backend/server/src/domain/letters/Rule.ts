import type { Situation } from "./Situation.js";
import type { Channel, Citation } from "./types.js";

export interface RuleProps {
  readonly ruleId: string;
  readonly document: string;
  readonly clause: string;
  // The label printed just before the quote on its page, such as (f) or (vii).
  readonly clauseMarker: string;
  readonly exactText: string;
  readonly page: number;
  readonly textFile: string;
  readonly sourceSha256: string;
  readonly tags: readonly string[];
  readonly channels: readonly Channel[];
}

// One quotable clause from data/rules/rules.json.
export class Rule {
  readonly ruleId: string;
  readonly clauseMarker: string;
  readonly exactText: string;
  readonly page: number;
  readonly textFile: string;
  readonly #props: RuleProps;

  constructor(props: RuleProps) {
    this.ruleId = props.ruleId;
    this.clauseMarker = props.clauseMarker;
    this.exactText = props.exactText;
    this.page = props.page;
    this.textFile = props.textFile;
    this.#props = props;
  }

  citableIn(channel: Channel): boolean {
    return this.#props.channels.includes(channel);
  }

  score(situation: Situation): number {
    return this.#props.tags.reduce((sum, tag) => sum + situation.weightOf(tag), 0);
  }

  // The document title and clause label a letter may print, quoted or not.
  labels(): readonly string[] {
    const { document, clause } = this.#props;
    return [document, clause, `${document}, ${clause}`];
  }

  // Fewer tags means the rule was written for fewer situations.
  breadth(): number {
    return this.#props.tags.length;
  }

  // Call only after the quote verifier has found exactText on its page.
  verifiedCitation(): Citation {
    const { ruleId, document, clause, exactText, sourceSha256 } = this.#props;
    return {
      rule_id: ruleId,
      document,
      clause,
      quote: exactText,
      source_sha256: sourceSha256,
      verified: true,
    };
  }
}
