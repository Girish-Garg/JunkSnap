import { CountNoun } from "../CountNoun.js";
import { BACKERS_NEEDED } from "../sites/Backers.js";
import type { LetterSite } from "./LetterSite.js";

type Phrase = (count: number, reporters: number | null) => string;

interface Phrases {
  readonly verified: Phrase;
  readonly unverified: Phrase;
}

const PEOPLE = new CountNoun("person", "people");
const RESIDENTS = new CountNoun("resident", "residents");
// Hindi nouns before ने take the oblique plural: "3 लोगों ने", but "1 व्यक्ति ने".
const PEOPLE_HI = new CountNoun("व्यक्ति", "लोगों");
const RESIDENTS_HI = new CountNoun("निवासी", "निवासियों");

const ENGLISH: Phrases = {
  verified: (count) => `${PEOPLE.of(count)} confirmed this site, so it is verified.`,
  unverified: (count, reporters) => {
    const who = reporters === null ? "residents" : RESIDENTS.of(reporters);
    return `Reported by ${who}; community verification in progress (${count} of ${BACKERS_NEEDED} people confirmed so far).`;
  },
};

const HINDI: Phrases = {
  verified: (count) => `${PEOPLE_HI.of(count)} ने इस स्थान की पुष्टि की है, इसलिए यह सत्यापित है।`,
  unverified: (count, reporters) => {
    const who = reporters === null ? "निवासियों" : RESIDENTS_HI.of(reporters);
    return `${who} ने इसकी सूचना दी है; सामुदायिक पुष्टि जारी है (${BACKERS_NEEDED} में से ${PEOPLE_HI.of(count)} ने अब तक पुष्टि की)।`;
  },
};

// Decision 20261011-1750: every site letter says how many people backed the site, and says verified only at 10.
export class BackingStatement {
  english(site: LetterSite): string {
    return BackingStatement.#say(ENGLISH, site);
  }

  hindi(site: LetterSite): string {
    return BackingStatement.#say(HINDI, site);
  }

  static #say(phrases: Phrases, site: LetterSite): string {
    const phrase = site.verified ? phrases.verified : phrases.unverified;
    return phrase(site.backers, site.evidence.reporters);
  }
}
