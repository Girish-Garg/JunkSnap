import type { ActionGate } from '../../../domain/ActionAvailability';
import type { SessionFacts } from '../../../domain/GateRules';
import { gatedBy, type GatedAction } from '../GatedAction';
import { useGate } from './useGate';
import { useSessionFacts } from './useSessionFacts';

type SessionKeys = 'signedIn' | 'online' | 'cooling';

/** Decides one action from the session (signed in, online, cooling down) plus the caller's own facts. */
export function useSessionGate<F extends Pick<SessionFacts, 'signedIn' | 'online'>>(rule: ActionGate<F>, own: Omit<F, SessionKeys>): GatedAction {
  const gate = useGate();
  const facts = { ...useSessionFacts(), ...own } as unknown as F;
  return gatedBy(gate, rule.decide(facts));
}
