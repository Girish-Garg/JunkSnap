import { useMemo } from 'react';
import type { ActionGate, Availability } from '../../../domain/ActionAvailability';
import type { LocationProblem } from '../../../domain/LocationError';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import { LOCATED_GATES, SITE_GATES, type SiteActionFacts } from '../../../domain/SiteActionGates';
import { gatedBy, type GatedAction } from '../GatedAction';
import { useGate, type Gate } from './useGate';
import { useLocationHelp, type LocationHelp } from './useLocationHelp';
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
  readonly reportPhoto: GatedAction;
}

type Rule = ActionGate<SiteActionFacts>;

/** How a tap that rests on location gets a fresh distance, and what it says when there is none. */
interface Located {
  readonly measure: () => Promise<number | LocationProblem>;
  readonly help: LocationHelp;
}

// The decision rests on a fix the app does not hold: too far by an older fix, location blocked, or no fix yet.
function needsFix(availability: Availability, facts: SiteActionFacts): boolean {
  if (availability.enabled) return facts.distanceM === null;
  const { remedy } = availability;
  return remedy === 'relocate' || remedy === 'allowLocation' || (remedy === 'signIn' && facts.distanceM === null);
}

// A tap takes a fresh fix and decides again with it, so the action goes through once in range. With no fix it says
// why and how to fix it, and its retry does all of this again.
function locatedTap(gate: Gate, rule: Rule, facts: SiteActionFacts, located: Located): GatedAction['tap'] {
  const attempt = (action: () => void) => (): void => {
    void located.measure().then((result) => {
      if (typeof result === 'number') return gate(rule.decide({ ...facts, distanceM: result, locationDenied: false }), action)();
      located.help(result, rule.decide({ ...facts, distanceM: null, locating: false, locationDenied: true }), attempt(action));
    });
  };
  return attempt;
}

function siteAction(gate: Gate, rule: Rule, facts: SiteActionFacts, located: Located | null): GatedAction {
  const availability = rule.decide(facts);
  if (!located || !needsFix(availability, facts)) return gatedBy(gate, availability);
  const attempt = locatedTap(gate, rule, facts, located);
  if (availability.enabled || availability.remedy !== 'allowLocation') return { availability, tap: attempt };
  // Blocked: the tap says where to allow it; Try again (in a browser) asks for a fix again.
  return { availability, tap: (action) => () => located.help('denied', availability, attempt(action)) };
}

/** The site sheet's gates, decided here so components only receive what each action can do. */
export function useSiteGates(site: SiteFeature, mapLocation: LonLat | null): SiteGates {
  const gate = useGate();
  const help = useLocationHelp();
  const { facts, measure } = useSiteFacts(site, mapLocation);
  return useMemo(() => {
    const located = measure ? { measure, help } : null;
    const action = (rule: Rule) => siteAction(gate, rule, facts, LOCATED_GATES.has(rule) ? located : null);
    return {
      facts,
      vote: action(SITE_GATES.vote),
      cleanup: action(SITE_GATES.cleanup),
      letter: action(SITE_GATES.letter),
      withdraw: action(SITE_GATES.withdraw),
      note: action(SITE_GATES.note),
      addPhoto: action(SITE_GATES.addPhoto),
      reportPhoto: action(SITE_GATES.reportPhoto),
    };
  }, [gate, help, facts, measure]);
}
