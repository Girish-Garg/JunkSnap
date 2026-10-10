import { useTranslation } from 'react-i18next';
import type { GatedAction } from '../../actions/GatedAction';
import { Celebrate } from '../../../ui/Celebrate';
import { useVote } from '../hooks/useVote';
import '../community.css';
import { VoteChoices } from './VoteChoices';

interface VoteBoxProps {
  readonly siteId: string;
  /** Whether this person can vote here (useSiteGates). */
  readonly gated: GatedAction;
  readonly onVoted: () => void;
  /** A no-bin zone asks "I confirm there's no bin within 1 km" instead (decision 20261010-1630). */
  readonly noBin?: boolean;
}

const TITLE_ID = 'vote-title';

/** The neighbour check: is this really a waste site? Votes count within 1 km of the site. */
export function VoteBox({ siteId, gated, onVoted, noBin = false }: VoteBoxProps) {
  const { t } = useTranslation();
  const words = noBin ? 'vote.noBin' : 'vote';
  const vote = useVote(siteId, onVoted, gated);
  return (
    <section className="vote-box" aria-labelledby={TITLE_ID}>
      <h3 id={TITLE_ID} className="vote-box__title">{t(`${words}.title`)}</h3>
      <p className="vote-box__text">{t(`${words}.text`)}</p>
      <VoteChoices words={words} action={vote.action} onVote={vote.vote} />
      {vote.result && <Celebrate />}
      {vote.result && (
        <p className="vote-box__note" role="status">
          {t(`${words}.thanks`, { yes: vote.result.votes.confirm, no: vote.result.votes.reject, cleared: vote.result.votes.cleaned ?? 0 })}
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
