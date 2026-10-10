import { useCallback } from 'react';
import type { RemovalOutcome } from '../../../domain/ActivityRemoval';
import { useMapContext } from '../../map/useMapContext';
import { ActivityDeleteMessage } from '../ActivityDeleteMessage';

/** After a delete: a toast that says what happened, and a fresh map when a report was withdrawn. */
export function useActivityDeleteFollowup() {
  const { refreshSites, announce } = useMapContext();
  return useCallback(
    (outcome: RemovalOutcome) => {
      if (outcome.kind === 'withdraw') refreshSites();
      announce(ActivityDeleteMessage.of(outcome));
    },
    [refreshSites, announce],
  );
}
