import { ActionGate, blocked, CHECKING, waiting, type Availability, type AvailabilityRule } from './ActionAvailability';
import type { IssueCount } from './AreaIssueTally';
import { GateRules, type SessionFacts } from './GateRules';
import type { SiteProperties } from './Site';
import { SiteListing } from './SiteListing';

/** contracts/README.md: votes count within 1 km of the site; a cleanup photo must be taken within 50 m. */
export const VOTE_RADIUS_M = 1000;
export const CLEANUP_RADIUS_M = 50;
// The map's location fix is older and rougher than the fresh fix the action sends, so only clearly too far blocks.
export const DISTANCE_MARGIN_M = 100;

export interface SiteActionFacts extends SessionFacts {
  readonly site: Pick<SiteProperties, 'verification' | 'status' | 'cleanup_status'>;
  /** This phone or this account sent a report that the api merged into the site, or the api said so (403 own_site). */
  readonly ownSite: boolean;
  /** Not known yet whether ownSite: this phone's reports, the saved sign-in or GET /me/reports are still loading. */
  readonly checkingOwner?: boolean;
  /** Metres between the person and the site from a fix under 2 minutes old (FreshFix); null when there is none. */
  readonly distanceM: number | null;
  /** The first fix is on its way, so a null distanceM means not known yet rather than none to be had. */
  readonly locating?: boolean;
  /** The browser said no to location, and a vote sends a fresh fix. */
  readonly locationDenied: boolean;
  /** The farthest a photo can still join this site from, up high (SitePhotoPreset.limitM); Send checks the photo's own fix. */
  readonly addPhotoLimitM: number;
}

export interface AreaLetterFacts extends SessionFacts {
  /** The area has the 10 verified reports the api needs. */
  readonly ready: boolean;
}

type Rule = AvailabilityRule<SiteActionFacts>;

type Limit = (facts: SiteActionFacts) => number;

// A tap takes a fresh fix first and goes through when that one is in range (remedy relocate). The reason gets the
// limit as {{limit}} for wording that names it. Until the first fix arrives the action waits, never looks open.
const tooFar = (limit: Limit, reason: string): Rule => (facts) => {
  if (facts.distanceM === null) return facts.locating ? waiting(CHECKING) : null;
  const limitM = limit(facts);
  return facts.distanceM > limitM + DISTANCE_MARGIN_M ? blocked(reason, { limit: limitM }, 'relocate') : null;
};
const within = (metres: number): Limit => () => metres;

// A deep link can open a letter or cleanup sheet for a site that already left the map.
const offMap = (reason = 'gate.siteClosed'): Rule => GateRules.when((facts) => !SiteListing.onMap(facts.site), reason);

const VOTE: readonly Rule[] = [
  GateRules.busy(),
  GateRules.when((facts) => facts.ownSite, 'vote.errors.own_site'),
  GateRules.waitWhile((facts) => facts.checkingOwner === true, CHECKING),
  tooFar(within(VOTE_RADIUS_M), 'vote.errors.too_far'),
  GateRules.when((facts) => facts.locationDenied, 'vote.errors.location'),
  GateRules.cooling('vote', 'vote.errors.rate_limited'),
  GateRules.offline(),
  GateRules.signIn('gate.signIn.vote'),
];

/**
 * The one model for what a person can do on a site that is still on the map (a closed site hides its actions,
 * SiteClosure). Each gate lists the reasons in the order the person most needs to hear them.
 */
export const SITE_GATES = {
  vote: new ActionGate<SiteActionFacts>(VOTE),
  cleanup: new ActionGate<SiteActionFacts>([
    GateRules.busy(),
    offMap(),
    GateRules.when((facts) => facts.site.cleanup_status === 'checking', 'cleanup.errors.cleanup_pending'),
    tooFar(within(CLEANUP_RADIUS_M), 'gate.tooFarCleanup'),
    GateRules.cooling('cleanup', 'cleanup.errors.rate_limited'),
    GateRules.offline(),
    GateRules.signIn('gate.signIn.cleanup'),
  ]),
  letter: new ActionGate<SiteActionFacts>([
    GateRules.busy(),
    offMap(),
    GateRules.when((facts) => facts.site.verification !== 'verified', 'actions.letterLocked'),
    GateRules.cooling('letter', 'letter.errors.rate_limited'),
    GateRules.offline(),
    GateRules.signIn('gate.signIn.letter'),
  ]),
  // Add a photo to this site (#132): opens Snap preset to the site; the photo's own fix is checked again on Send.
  // No offline rule: Snap saves the photo on the phone and sends it later, so blocking offline would lose reports.
  addPhoto: new ActionGate<SiteActionFacts>([
    offMap('addPhoto.closed'),
    tooFar((facts) => facts.addPhotoLimitM, 'addPhoto.tooFar'),
    GateRules.signIn('addPhoto.signIn'),
  ]),
  // "Report this photo" (#133): within 1 km of the site, by the same fresh-fix rule as a vote, and signed in.
  reportPhoto: new ActionGate<SiteActionFacts>([
    offMap(),
    tooFar(within(VOTE_RADIUS_M), 'gate.tooFarReport'),
    GateRules.cooling('reportPhoto', 'photoReport.errors.rate_limited'),
    GateRules.signIn('gate.signIn.reportPhoto'),
  ]),
  withdraw: new ActionGate<SiteActionFacts>([
    GateRules.busy(),
    GateRules.when((facts) => facts.site.verification === 'verified', 'withdraw.errors.site_verified'),
    GateRules.cooling('withdraw', 'withdraw.errors.rate_limited'),
    GateRules.offline(),
    GateRules.signIn('gate.signIn.withdraw'),
  ]),
  // Writing needs neither a connection nor a session; Send asks for both, and what was typed stays.
  note: new ActionGate<SiteActionFacts>([GateRules.cooling('note', 'notes.errors.rate_limited')]),
} as const;

export interface NoteFacts extends SessionFacts {
  readonly empty: boolean;
}

/** Send on the note form: the api refuses empty text (400 bad_request), so the app says so first. */
export const NOTE_SEND_GATE = new ActionGate<NoteFacts>([
  GateRules.busy(),
  GateRules.when((facts) => facts.empty, 'gate.noteEmpty'),
  GateRules.cooling('note', 'notes.errors.rate_limited'),
  GateRules.offline(),
  GateRules.signIn('gate.signIn.note'),
]);

/** Send on the cleanup review: the photo goes straight to the api, so it needs a connection and a session. */
export const CLEANUP_SEND_GATE = new ActionGate<SessionFacts>([
  GateRules.busy('cleanup.sending'),
  GateRules.cooling('cleanup', 'cleanup.errors.rate_limited'),
  GateRules.offline(),
  GateRules.signIn('gate.signIn.cleanup'),
]);

/** Draft in the letter sheet, for a site or an area; the api allows 5 letters an hour across both. */
export const LETTER_DRAFT_GATE = new ActionGate<SessionFacts>([
  GateRules.busy('letter.drafting'),
  GateRules.cooling('letter', 'letter.errors.rate_limited'),
  GateRules.offline(),
  GateRules.signIn('gate.signIn.letter'),
]);

export interface DeleteFacts extends SessionFacts {
  /** Deleting the row also withdraws this phone's report from a site nobody has verified (DELETE /sites/{id}/reports/mine). */
  readonly withdraws: boolean;
}

const withdraws = (facts: DeleteFacts) => facts.withdraws;

/** "Yes, delete" on an Activity row: only a delete that withdraws needs the api; the rest just leaves this phone. */
export const ACTIVITY_DELETE_GATE = new ActionGate<DeleteFacts>([
  GateRules.busy('activityDelete.busy'),
  GateRules.onlyIf(withdraws, GateRules.cooling('withdraw', 'activityDelete.errors.rate_limited')),
  GateRules.onlyIf(withdraws, GateRules.offline()),
  GateRules.onlyIf(withdraws, GateRules.signIn('gate.signIn.withdraw')),
]);

/** "Draft a letter about this area", on the area page and in the ranking; shares the letter cooldown. */
export const AREA_LETTER_GATE = new ActionGate<AreaLetterFacts>([
  GateRules.busy(),
  GateRules.when((facts) => !facts.ready, 'areaLetter.locked'),
  GateRules.cooling('letter', 'letter.errors.rate_limited'),
  GateRules.offline(),
  GateRules.signIn('gate.signIn.letter'),
]);

export interface AreaIssueFacts {
  readonly count: IssueCount;
  readonly min: number;
}

/** One issue in the area letter sheet: off once the area surely has too few verified reports of it (the api's 409 not_verified). */
export const AREA_ISSUE_GATE = new ActionGate<AreaIssueFacts>([
  ({ count, min }) => {
    if (count.most >= min) return null;
    return count.seen === count.most ? blocked(`areaLetter.tooFew.${count.issue}`, { n: count.seen, min }) : blocked('areaLetter.tooFewHere', { min });
  },
]);

// A deep-linked sheet checks only what the site or area itself allows; its own Draft or Send button says the rest.
const ROUTE_SESSION: SessionFacts = { signedIn: true, online: true, cooling: new Set() };

/** Whether a letter or cleanup sheet opened by link can be used at all: off the map, not verified, a photo checking. */
export function decideSiteRoute(rule: ActionGate<SiteActionFacts>, site: SiteActionFacts['site']): Availability {
  return rule.decide({ ...ROUTE_SESSION, site, ownSite: false, distanceM: null, locationDenied: false, addPhotoLimitM: 0 });
}

/** Whether an area letter sheet opened by link can draft at all: 10 verified reports. */
export function decideAreaLetterRoute(ready: boolean): Availability {
  return AREA_LETTER_GATE.decide({ ...ROUTE_SESSION, ready });
}
