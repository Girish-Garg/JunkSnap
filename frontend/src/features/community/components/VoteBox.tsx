import { useTranslation } from 'react-i18next';
import { Button } from '../../../ui/Button';
import { Celebrate } from '../../../ui/Celebrate';
import { useVote } from '../hooks/useVote';
import '../community.css';

interface VoteBoxProps {
  readonly siteId: string;
  readonly onVoted: () => void;
  /** A no-bin zone asks "I confirm there's no bin within 1 km" instead (decision 20261010-1630). */
  readonly noBin?: boolean;
}

const TITLE_ID = 'vote-title';

/** The neighbour check: is this really a waste site? Votes count within 1 km of the site. */
export function VoteBox({ siteId, onVoted, noBin = false }: VoteBoxProps) {
  const { t } = useTranslation();
  const words = noBin ? 'vote.noBin' : 'vote';
  const vote = useVote(siteId, onVoted);
  return (
    <section className="vote-box" aria-labelledby={TITLE_ID}>
      <h3 id={TITLE_ID} className="vote-box__title">{t(`${words}.title`)}</h3>
      <p className="vote-box__text">{t(`${words}.text`)}</p>
      <div className="vote-box__buttons">
        <Button onClick={() => vote.vote('confirm')} disabled={vote.busy}>
          {t(`${words}.yes`)}
        </Button>
        <Button variant="text" onClick={() => vote.vote('reject')} disabled={vote.busy}>
          {t('vote.no')}
        </Button>
      </div>
      {vote.result && <Celebrate />}
      {vote.result && (
        <p className="vote-box__note" role="status">
          {t('vote.thanks', { yes: vote.result.votes.confirm, no: vote.result.votes.reject })}
        </p>
      )}
      {vote.problem && (
        <p className="form__error" role="alert">
          {t(`vote.errors.${vote.problem}`)}
        </p>
      )}
    </section>
  );
}
