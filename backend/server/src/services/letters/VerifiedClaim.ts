import { BACKERS_NEEDED } from "../../domain/sites/Backers.js";

// Honest ways to say a site is not verified yet; each is removed before looking for a claim.
const NOT_YET: readonly RegExp[] = [
  /(?:\bnot|n['’]t)\s+(?:yet\s+)?(?:been\s+)?verified\b/giu, // not verified, not yet verified, hasn't been verified
  /\bto\s+be\s+verified\b/giu, // yet to be verified, needs to be verified
  /\bwill\s+be\s+verified\b/giu,
  /\b(?:once|until|before|when)\s+(?:it\s+is\s+)?verified\b/giu,
  /\bverified\s+word\s+for\s+word\b/giu, // the quotes, not the site
  /सत्यापित\s+नहीं/gu, // सत्यापित नहीं, अभी सत्यापित नहीं
  /सत्यापित\s+होना\s+(?:अभी\s+)?बाकी/gu, // yet to be verified
  /सत्यापित\s+होने\s+(?:के\s+बाद|पर|तक)/gu, // once or until verified
  /सत्यापित\s+(?:हो\s+जाएगा|होगा)/gu, // will be verified
];

// unverified, verification, असत्यापित and सत्यापन are other words, so they never match.
const VERIFIED = /\bverified\b|(?<![\p{L}\p{M}])सत्यापित(?![\p{L}\p{M}])/iu;
const VERIFIED_BY = /\bverified\s+by\s+(\d+)|(\d+)\s+लोगों\s+द्वारा\s+सत्यापित/giu;

// Decision 20261011-1750: what a letter's own prose says about verification, in English or Hindi.
export class VerifiedClaim {
  readonly #prose: string;

  constructor(prose: string) {
    this.#prose = prose.normalize("NFC");
  }

  // Says the site is verified: "is verified", "has been verified", "a verified site", "सत्यापित है".
  affirms(): boolean {
    const rest = NOT_YET.reduce((text, pattern) => text.replace(pattern, " "), this.#prose);
    return VERIFIED.test(rest);
  }

  // Says "verified by N people" with N short of the people verification needs.
  undercounts(): boolean {
    return [...this.#prose.matchAll(VERIFIED_BY)].some((match) => Number(match[1] ?? match[2]) < BACKERS_NEEDED);
  }
}
