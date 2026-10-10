import { useState } from 'react';
import type { SiteFeature } from '../../../domain/Site';
import type { SiteActionFacts } from '../../../domain/SiteActionGates';
import { VoteBox } from '../../community/components/VoteBox';
import type { SitePresenter } from '../SitePresenter';
import { SiteActions } from './SiteActions';
import { WithdrawReport } from './WithdrawReport';

interface SiteOpenActionsProps {
  readonly site: SiteFeature;
  readonly presenter: SitePresenter;
  readonly facts: SiteActionFacts;
  /** Called after a vote or a withdrawal, so the sheet reads the site again. */
  readonly onChanged: () => void;
}

/** The actions, the neighbour check and the reporter's withdrawal of a site that is still on the map. */
export function SiteOpenActions({ site, presenter, facts, onChanged }: SiteOpenActionsProps) {
  const details = site.properties;
  // An unverified site shows the vote straight away; others after Confirm. The server refuses its own reporters.
  const [voting, setVoting] = useState(details.verification === 'unverified');
  return (
    <>
      <SiteActions site={site} presenter={presenter} facts={facts} onConfirm={() => setVoting(true)} onChanged={onChanged} />
      {voting && <VoteBox siteId={details.site_id} facts={facts} onVoted={onChanged} noBin={details.report_type === 'no_bin'} />}
      <WithdrawReport site={details} facts={facts} onChanged={onChanged} />
    </>
  );
}
