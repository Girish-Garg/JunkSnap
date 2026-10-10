import { useTranslation } from 'react-i18next';
import { lookOf } from '../../../domain/ActionAvailability';
import { SITE_GATES, type SiteActionFacts } from '../../../domain/SiteActionGates';
import { Button } from '../../../ui/Button';
import { useGate } from '../../actions/hooks/useGate';
import { useVote } from '../../community/hooks/useVote';

interface ClearanceVotesProps {
  readonly siteId: string;
  readonly facts: SiteActionFacts;
  readonly onChanged: () => void;
}

/** "It's cleared" or "Still there": a cleared or yes vote, off with the reason where this person cannot vote. */
export function ClearanceVotes({ siteId, facts, onChanged }: ClearanceVotesProps) {
  const { t } = useTranslation();
  const gate = useGate();
  const vote = useVote(siteId, onChanged);
  const availability = SITE_GATES.vote.decide({ ...facts, busy: vote.busy });
  const look = lookOf(availability);
  return (
    <>
      <div className="clearance__buttons">
        <Button onClick={gate(availability, () => vote.vote('cleaned'))} {...look}>
          {t('clearance.cleared')}
        </Button>
        <Button variant="secondary" onClick={gate(availability, () => vote.vote('confirm'))} {...look}>
          {t('clearance.stillThere')}
        </Button>
      </div>
      {vote.problem && (
        <p className="form__error" role="alert">
          {t(`vote.errors.${vote.problem}`)}
        </p>
      )}
    </>
  );
}
