import { useEffect, useRef } from 'react';
import { AppLinkListener } from '../services/AppLinkListener';
import { AppLinkRoutes } from './AppLinkRoutes';
import { useSheetNavigation } from './useSheetNavigation';

/** Inside the Android app, a link that opened it (junksnap://sites/..., a share link) opens that screen as a sheet. */
export function useAppLinks(): void {
  const { open } = useSheetNavigation();
  const latest = useRef(open);
  useEffect(() => {
    latest.current = open;
  }, [open]);
  useEffect(() => new AppLinkListener(window, new AppLinkRoutes()).listen((path) => latest.current(path)), []);
}
