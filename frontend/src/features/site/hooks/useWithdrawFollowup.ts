import { useCallback } from 'react';
import { useServices } from '../../../app/useServices';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import type { QueuedReport } from '../../../domain/QueuedReport';
import type { WithdrawalResult } from '../../../domain/SiteActions';
import { useMapContext } from '../../map/useMapContext';

/** After a withdrawal: Activity says Withdrawn, the map fetches again, a toast confirms, and a removed site's sheet closes. */
export function useWithdrawFollowup(onChanged: () => void) {
  const { snap } = useServices();
  const { refreshSites, announce } = useMapContext();
  const sheets = useSheetNavigation();
  return useCallback(
    async (result: WithdrawalResult, mine: readonly QueuedReport[]) => {
      const local = mine.flatMap((report) => (report.data.report_id === null ? [] : [report.data.report_id]));
      await snap.tracker.markWithdrawn([...result.withdrawn_report_ids, ...local]);
      refreshSites();
      announce(result.site_removed ? 'withdraw.removed' : 'withdraw.done');
      if (result.site_removed) sheets.close('/');
      else onChanged();
    },
    [snap.tracker, refreshSites, announce, sheets, onChanged],
  );
}
