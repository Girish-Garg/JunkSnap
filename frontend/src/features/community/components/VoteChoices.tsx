import { useTranslation } from 'react-i18next';
import type { VoteChoice } from '../../../domain/SiteActions';
import { Button } from '../../../ui/Button';

interface VoteChoicesProps {
  /** vote or vote.noBin: the yes wording differs for a no-bin zone. */
  readonly words: string;
  readonly busy: boolean;
  readonly onVote: (choice: VoteChoice) => void;
}

/** Yes, no, or cleared now: 3 more people saying cleared than still there take the site off the map (decision 20261010-1700). */
export function VoteChoices({ words, busy, onVote }: VoteChoicesProps) {
  const { t } = useTranslation();
  return (
    <div className="vote-box__buttons">
      <Button onClick={() => onVote('confirm')} disabled={busy}>
        {t(`${words}.yes`)}
      </Button>
      <Button variant="text" onClick={() => onVote('reject')} disabled={busy}>
        {t('vote.no')}
      </Button>
      <Button variant="text" onClick={() => onVote('cleaned')} disabled={busy}>
        {t(`${words}.cleaned`)}
      </Button>
    </div>
  );
}
