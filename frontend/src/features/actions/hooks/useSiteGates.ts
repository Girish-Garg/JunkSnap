import { useMemo } from 'react';
import type { ActionGate } from '../../../domain/ActionAvailability';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import { SITE_GATES, type SiteActionFacts } from '../../../domain/SiteActionGates';
import { gatedBy, type GatedAction } from '../GatedAction';
import { useGate, type Gate } from './useGate';
import { useSiteFacts } from './useSiteFacts';

/** What a person can do on one site now, each with its tap handler. */
export interface SiteGates {
  readonly facts: SiteActionFacts;
  readonly vote: GatedAction;
  readonly cleanup: GatedAction;
  readonly letter: GatedAction;
  readonly withdraw: GatedAction;
  readonly note: GatedAction;
  readonly addPhoto: GatedAction;
}

type Remeasure = () => Promise<number | null>;

// "Too far" rests on a fix: a tap takes a fresh one and decides again, so the action goes through once in range.
function siteAction(gate: Gate, rule: ActionGate<SiteActionFacts>, facts: SiteActionFacts, remeasure: Remeasure): GatedAction {
  const availability = rule.decide(facts);
  if (availability.enabled || availability.remedy !== 'relocate') return gatedBy(gate, availability);
  const tap = (action: () => void) => () => {
    void remeasure().then((distanceM) => gate(rule.decide({ ...facts, distanceM }), action)());
  };
  return { availability, tap };
}

/** The site sheet's gates, decided here so components only receive what each action can do. */
export function useSiteGates(site: SiteFeature, mapLocation: LonLat | null): SiteGates {
  const gate = useGate();
  const { facts, remeasure } = useSiteFacts(site, mapLocation);
  return useMemo(() => {
    const action = (rule: ActionGate<SiteActionFacts>) => siteAction(gate, rule, facts, remeasure);
    return {
      facts,
      vote: action(SITE_GATES.vote),
      cleanup: action(SITE_GATES.cleanup),
      letter: action(SITE_GATES.letter),
      withdraw: action(SITE_GATES.withdraw),
      note: action(SITE_GATES.note),
      addPhoto: action(SITE_GATES.addPhoto),
    };
  }, [gate, facts, remeasure]);
}
