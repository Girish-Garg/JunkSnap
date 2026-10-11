import { blocked, CHECKING, waiting, type AvailabilityRule } from './ActionAvailability';

/** What every action that talks to the api depends on. */
export interface SessionFacts {
  readonly signedIn: boolean;
  readonly online: boolean;
  /** Action groups the api answered 429 rate_limited for a moment ago (ActionCooldowns). */
  readonly cooling: ReadonlySet<string>;
  /** The action is already on its way. */
  readonly busy?: boolean;
  /** The saved sign-in is still being read at start, so signed out may not be true yet. */
  readonly restoring?: boolean;
}

/** The rules that several actions share; each action lists them in its own order. */
export class GateRules {
  /** First: while the action is on its way, the button waits. */
  static busy<F extends Pick<SessionFacts, 'busy'>>(reason = 'gate.busy'): AvailabilityRule<F> {
    return (facts) => (facts.busy ? waiting(reason) : null);
  }

  static offline<F extends Pick<SessionFacts, 'online'>>(): AvailabilityRule<F> {
    return (facts) => (facts.online ? null : blocked('gate.offline'));
  }

  /** group: the cooldown the action shares, e.g. site and area letters share the 5 letters an hour. */
  static cooling<F extends Pick<SessionFacts, 'cooling'>>(group: string, reason: string): AvailabilityRule<F> {
    return (facts) => (facts.cooling.has(group) ? blocked(reason) : null);
  }

  /** Last: signing in fixes it, so the tap opens sign-in and then runs the action; while the sign-in is read, it waits. */
  static signIn<F extends Pick<SessionFacts, 'signedIn' | 'restoring'>>(reason: string): AvailabilityRule<F> {
    return (facts) => {
      if (facts.signedIn) return null;
      return facts.restoring ? waiting(CHECKING) : blocked(reason, undefined, 'signIn');
    };
  }

  static when<F>(applies: (facts: F) => boolean, reason: string): AvailabilityRule<F> {
    return (facts) => (applies(facts) ? blocked(reason) : null);
  }

  /** A rule that applies only in some cases, e.g. a delete that also withdraws from a site. */
  static onlyIf<F>(applies: (facts: F) => boolean, rule: AvailabilityRule<F>): AvailabilityRule<F> {
    return (facts) => (applies(facts) ? rule(facts) : null);
  }

  /** Something that clears by itself in a moment, e.g. the camera starting. */
  static waitWhile<F>(applies: (facts: F) => boolean, reason: string): AvailabilityRule<F> {
    return (facts) => (applies(facts) ? waiting(reason) : null);
  }
}
