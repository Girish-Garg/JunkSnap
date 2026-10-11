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
  /** A no-bin zone: "There's a bin here now" or "Still no bin". */
  readonly noBin: boolean;
}

/** "It's cleared" or "Still there": a cleared or yes vote, off with the reason where this person cannot vote. */
export function ClearanceVotes({ siteId, gated, onChanged, noBin }: ClearanceVotesProps) {
  const { t } = useTranslation();
  const words = noBin ? 'clearance.noBin' : 'clearance';
  const vote = useVote(siteId, onChanged, gated);
  const { action } = vote;
  const look = lookOf(action.availability);
  return (
    <>
      <div className="clearance__buttons">
        <Button onClick={action.tap(() => vote.vote('cleaned'))} {...look}>
          {t(`${words}.cleared`)}
        </Button>
        <Button variant="secondary" onClick={action.tap(() => vote.vote('confirm'))} {...look}>
          {t(`${words}.stillThere`)}
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
