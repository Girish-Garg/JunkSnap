import { waiting, type Availability } from '../../domain/ActionAvailability';
import type { Gate } from './hooks/useGate';

/** What a component gets for an action: whether it can run now, and the tap handler that runs it or says why. */
export interface GatedAction {
  readonly availability: Availability;
  readonly tap: (action: () => void) => () => void;
}

/** A gated action whose tap is the app's gate: run, say why, or open sign-in first. */
export function gatedBy(gate: Gate, availability: Availability): GatedAction {
  return { availability, tap: (action) => gate(availability, action) };
}

/** While the action is on its way the button simply waits. */
export function whileBusy(gated: GatedAction, busy: boolean, reason = 'gate.busy'): GatedAction {
  return busy ? { availability: waiting(reason), tap: gated.tap } : gated;
}
