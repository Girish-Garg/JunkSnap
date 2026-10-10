import { ActionGate, type AvailabilityRule } from './ActionAvailability';
import { GateRules, type SessionFacts } from './GateRules';
import type { SiteProperties } from './Site';

/** contracts/README.md: votes count within 1 km of the site; a cleanup photo must be taken within 50 m. */
export const VOTE_RADIUS_M = 1000;
export const CLEANUP_RADIUS_M = 50;
// The map's location fix is older and rougher than the fresh fix the action sends, so only clearly too far blocks.
export const DISTANCE_MARGIN_M = 100;

export interface SiteActionFacts extends SessionFacts {
  readonly site: Pick<SiteProperties, 'verification' | 'cleanup_status'>;
  /** This phone sent a report that the api merged into the site; the api refuses its votes (403 own_site). */
  readonly ownSite: boolean;
  /** Metres between the person's last known location and the site; null when the app does not know. */
  readonly distanceM: number | null;
  /** The browser said no to location, and a vote sends a fresh fix. */
  readonly locationDenied: boolean;
}

export interface AreaLetterFacts extends SessionFacts {
  /** The area has the 10 verified reports the api needs. */
  readonly ready: boolean;
}

type Rule = AvailabilityRule<SiteActionFacts>;

const tooFar = (limitM: number, reason: string): Rule =>
  GateRules.when((facts: SiteActionFacts) => facts.distanceM !== null && facts.distanceM > limitM + DISTANCE_MARGIN_M, reason);

const VOTE: readonly Rule[] = [
  GateRules.busy(),
  GateRules.when((facts) => facts.ownSite, 'vote.errors.own_site'),
  tooFar(VOTE_RADIUS_M, 'vote.errors.too_far'),
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
    GateRules.when((facts) => facts.site.cleanup_status === 'checking', 'cleanup.errors.cleanup_pending'),
    tooFar(CLEANUP_RADIUS_M, 'gate.tooFarCleanup'),
    GateRules.cooling('cleanup', 'cleanup.errors.rate_limited'),
    GateRules.offline(),
    GateRules.signIn('gate.signIn.cleanup'),
  ]),
  letter: new ActionGate<SiteActionFacts>([
    GateRules.busy(),
    GateRules.when((facts) => facts.site.verification !== 'verified', 'actions.letterLocked'),
    GateRules.cooling('letter', 'letter.errors.rate_limited'),
    GateRules.offline(),
    GateRules.signIn('gate.signIn.letter'),
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
