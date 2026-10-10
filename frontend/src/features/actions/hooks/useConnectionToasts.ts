import { useEffect, useRef } from 'react';
import { useServices } from '../../../app/useServices';
import { useOnline } from '../../../ui/useOnline';

/** Says "Back online" once the connection returns; while it is gone, sheets and the map say so themselves. */
export function useConnectionToasts(): void {
  const { notifier } = useServices();
  const online = useOnline();
  const before = useRef(online);
  useEffect(() => {
    if (online && !before.current) {
      notifier.drop('gate.offline');
      notifier.push({ key: 'connection.back' });
    }
    before.current = online;
  }, [online, notifier]);
}
