import { useTranslation } from 'react-i18next';
import { lookOf } from '../../../domain/ActionAvailability';
import { Button } from '../../../ui/Button';
import type { GatedAction } from '../../actions/GatedAction';
import { useVote } from '../../community/hooks/useVote';

interface ClearanceVotesProps {
  readonly siteId: string;
  /** Whether this person can vote here (useSiteGates). */
  readonly gated: GatedAction;
  readonly onChanged: () => void;
}

/** "It's cleared" or "Still there": a cleared or yes vote, off with the reason where this person cannot vote. */
export function ClearanceVotes({ siteId, gated, onChanged }: ClearanceVotesProps) {
  const { t } = useTranslation();
  const vote = useVote(siteId, onChanged, gated);
  const { action } = vote;
  const look = lookOf(action.availability);
  return (
    <>
      <div className="clearance__buttons">
        <Button onClick={action.tap(() => vote.vote('cleaned'))} {...look}>
          {t('clearance.cleared')}
        </Button>
        <Button variant="secondary" onClick={action.tap(() => vote.vote('confirm'))} {...look}>
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
