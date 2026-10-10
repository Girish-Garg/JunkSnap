import { AREA_LETTER_GATE } from '../../../domain/SiteActionGates';
import type { GatedAction } from '../GatedAction';
import { useSessionGate } from './useSessionGate';

/** "Draft a letter about this area": open once the area has the 10 verified reports the api needs. */
export function useAreaLetterGate(ready: boolean): GatedAction {
  return useSessionGate(AREA_LETTER_GATE, { ready });
}
