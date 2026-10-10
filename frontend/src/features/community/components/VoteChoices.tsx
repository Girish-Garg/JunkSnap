import { useTranslation } from 'react-i18next';
import { lookOf, type Availability } from '../../../domain/ActionAvailability';
import type { VoteChoice } from '../../../domain/SiteActions';
import { Button } from '../../../ui/Button';
import { useGate } from '../../actions/hooks/useGate';

interface VoteChoicesProps {
  /** vote or vote.noBin: the yes wording differs for a no-bin zone. */
  readonly words: string;
  /** Whether this person can vote here now; when not, each button says why. */
  readonly availability: Availability;
  readonly onVote: (choice: VoteChoice) => void;
}

/** Yes, no, or cleared now: 3 more people saying cleared than still there take the site off the map (decision 20261010-1700). */
export function VoteChoices({ words, availability, onVote }: VoteChoicesProps) {
  const { t } = useTranslation();
  const gate = useGate();
  const look = lookOf(availability);
  return (
    <div className="vote-box__buttons">
      <Button onClick={gate(availability, () => onVote('confirm'))} {...look}>
        {t(`${words}.yes`)}
      </Button>
      <Button variant="text" onClick={gate(availability, () => onVote('reject'))} {...look}>
        {t('vote.no')}
      </Button>
      <Button variant="text" onClick={gate(availability, () => onVote('cleaned'))} {...look}>
        {t(`${words}.cleaned`)}
      </Button>
    </div>
  );
}
