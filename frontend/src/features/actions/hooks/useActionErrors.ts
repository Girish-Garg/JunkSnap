import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useServices } from '../../../app/useServices';
import { useAuthFlow } from '../../auth/hooks/useAuthFlow';
import { ActionProblem } from '../../site/ActionProblem';

/**
 * Turns a failure into the key of its line under the action's errors.*. retry runs the action again after a fresh
 * sign-in; pass null on that retry itself, so a second 401 only shows the sign_in line instead of asking again.
 */
export type ActionErrorHandler = (error: unknown, retry: (() => void) | null) => string;

/**
 * The one way an action handles a failure: report it (console, structured tag), hold the action after a 429 so its
 * button says why, and on a 401 open sign-in and retry once after, keeping what the person typed.
 * group: the cooldown and log name, e.g. vote; known: the api codes the action words itself.
 */
export function useActionErrors(group: string, known: ReadonlySet<string>): ActionErrorHandler {
  const { errors, cooldowns } = useServices();
  const { reauth } = useAuthFlow();
  const { t } = useTranslation();
  return useCallback(
    (error, retry) => {
      const classified = errors.report(group, error);
      if (classified.category === 'rate_limited') cooldowns.hold(group);
      if (classified.category === 'auth_expired' && retry) reauth(retry, t('gate.sessionExpired'));
      return ActionProblem.from(classified, known);
    },
    [errors, cooldowns, reauth, t, group, known],
  );
}
