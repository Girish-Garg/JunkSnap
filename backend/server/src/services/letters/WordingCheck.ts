import type { CcLine } from "../../domain/letters/types.js";

type Office = CcLine["office"];

// Shared wording in contracts/README.md: never "illegal" or "culprit"; Hindi is matched without nukta.
const FORBIDDEN = /\b(?:illegal(?:ly)?|culprits?)\b|(?<![\p{L}\p{M}])(?:अवैध|गैर-?\s?कानूनी|दोषी|अपराधी)(?![\p{L}\p{M}])/iu;

// An honorific before a word is how a name shows up in a letter.
const PERSON = [
  /\b(?:Mr|Mrs|Ms|Mx|Shri|Shrimati|Smt|Sri|Sh|Dr|Kumari)\.?\s+\p{L}/u,
  /(?<![\p{L}\p{M}])(?:श्रीमती|श्री|सुश्री|कुमारी|डॉ\.?|डॉक्टर)(?![\p{L}\p{M}])\s*\p{L}/u,
];

const OFFICES: Readonly<Record<Office, RegExp>> = {
  councillor: /\bcouncill?ors?\b|पार्षद/iu,
  mla: /\bMLAs?\b|member of (?:the )?legislative assembly|विधायक/iu,
  mp: /\bMPs?\b|member of parliament|सांसद/iu,
};

const NUKTA = /़/gu;

// Checks a model draft's own prose, quotes removed, against the shared wording and the Cc list.
export class WordingCheck {
  problem(prose: string, cc: readonly CcLine[]): string | null {
    const text = prose.normalize("NFC").replace(NUKTA, "");
    if (FORBIDDEN.test(text)) {
      return "uses a word the shared wording forbids";
    }
    if (PERSON.some((pattern) => pattern.test(text))) {
      return "names a person";
    }
    const extra = (Object.keys(OFFICES) as Office[]).find(
      (office) => OFFICES[office].test(text) && !cc.some((line) => line.office === office),
    );
    return extra === undefined ? null : `mentions the ${extra} office, which is not copied`;
  }
}
