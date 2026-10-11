import { AVAILABLE } from '../../../domain/ActionAvailability';
import type { AreaIssueTally, IssueCount } from '../../../domain/AreaIssueTally';
import { AREA_ISSUES, type AreaIssue } from '../../../domain/AreaLetter';
import { AREA_ISSUE_GATE } from '../../../domain/SiteActionGates';
import { gatedBy, type GatedAction } from '../../actions/GatedAction';
import { useGate } from '../../actions/hooks/useGate';

export interface IssueChoice {
  readonly issue: AreaIssue;
  /** "7"; "7+" when the map may not show every site of it; empty when not known. */
  readonly count: string;
  readonly gated: GatedAction;
}

function countText({ seen, most }: IssueCount): string {
  if (seen === most) return String(seen);
  return seen > 0 ? `${seen}+` : '';
}

/** Each issue with its verified count, off (a tap says why) once the area surely has too few reports of it. */
export function useAreaIssues(tally: AreaIssueTally | null): readonly IssueChoice[] {
  const gate = useGate();
  if (!tally) return AREA_ISSUES.map((issue) => ({ issue, count: '', gated: gatedBy(gate, AVAILABLE) }));
  return tally.counts().map((count) => ({ issue: count.issue, count: countText(count), gated: gatedBy(gate, AREA_ISSUE_GATE.decide({ count, min: tally.min })) }));
}
