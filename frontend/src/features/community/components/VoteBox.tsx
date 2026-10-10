import { useTranslation } from 'react-i18next';
import { Celebrate } from '../../../ui/Celebrate';
import { useVote } from '../hooks/useVote';
import '../community.css';
import { VoteChoices } from './VoteChoices';

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
      <VoteChoices words={words} busy={vote.busy} onVote={vote.vote} />
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
