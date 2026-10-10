import { useTranslation } from 'react-i18next';
import type { GatedAction } from '../../actions/GatedAction';
import { useVote } from './useVote';

/**
 * "Me too": one tap sends a yes vote, which backs the site like a photo does (decision 20261010-1530).
 * The api keeps only the latest vote per person, so a second tap changes nothing. note is the line under the actions.
 */
export function useMeToo(siteId: string, onVoted: () => void, gated: GatedAction) {
  const { t } = useTranslation();
  const vote = useVote(siteId, onVoted, gated);
  const note = vote.problem ? t(`vote.errors.${vote.problem}`) : vote.result ? t('actions.metooThanks') : null;
  return { action: vote.action, note, send: () => vote.vote('confirm') };
}
