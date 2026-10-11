/**
 * signIn: the reason goes away after sign-in, so a tap opens it and then runs the action.
 * relocate: the reason rests on a location fix, so a tap takes a fresh one and runs the action if it is in range.
 */
export type Remedy = 'signIn' | 'relocate';

export interface Blocked {
  readonly enabled: false;
  /** i18n key of the reason, shown when the person taps the action anyway. */
  readonly reason: string;
  readonly params?: Readonly<Record<string, number>>;
  readonly remedy?: Remedy;
  /** Clears by itself in a moment (sending, camera starting, first GPS fix): the button is simply disabled. */
  readonly waiting?: boolean;
}

/** Whether a person can do an action now; when not, why. An action is never hidden while a reason exists. */
export type Availability = { readonly enabled: true } | Blocked;

export const AVAILABLE: Availability = { enabled: true };

export function blocked(reason: string, params?: Readonly<Record<string, number>>, remedy?: Remedy): Blocked {
  return { enabled: false, reason, ...(params ? { params } : {}), ...(remedy ? { remedy } : {}) };
}

export function waiting(reason: string): Blocked {
  return { enabled: false, reason, waiting: true };
}

/** The wait while something the decision rests on is still loading: this phone's reports, the sign-in, the first fix. */
export const CHECKING = 'gate.checking';

export function isChecking(availability: Availability): boolean {
  return !availability.enabled && availability.waiting === true && availability.reason === CHECKING;
}

/** How a button shows its availability. */
export interface ActionLook {
  /** Natively disabled: only while waiting for something that clears by itself. */
  readonly disabled: boolean;
  /** aria-disabled and muted, but tappable so the tap can say why. Sign-in actions look normal and open sign-in. */
  readonly blocked: boolean;
}

export function lookOf(availability: Availability): ActionLook {
  if (availability.enabled) return { disabled: false, blocked: false };
  return { disabled: availability.waiting === true, blocked: availability.waiting !== true && availability.remedy !== 'signIn' };
}

/** One reason an action can be off; null when it does not apply. */
export type AvailabilityRule<Facts> = (facts: Facts) => Availability | null;

/** An action's rules in order of what the person most needs to hear; the first that applies wins. */
export class ActionGate<Facts> {
  readonly #rules: readonly AvailabilityRule<Facts>[];

  constructor(rules: readonly AvailabilityRule<Facts>[]) {
    this.#rules = rules;
  }

  decide(facts: Facts): Availability {
    for (const rule of this.#rules) {
      const result = rule(facts);
      if (result) return result;
    }
    return AVAILABLE;
  }
}
