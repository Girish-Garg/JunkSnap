import { useCallback, useState } from 'react';
import type { ThinState } from '../../../domain/ThinView';
import { BrowserStore } from '../../../services/BrowserStore';
import { MapNotice } from '../MapNotice';
import type { MapPageState } from './useMapPage';

type CardSources = Pick<MapPageState, 'thin' | 'sheetOpen' | 'selection' | 'areaCard' | 'notice'>;

export type ThinCardState = ReturnType<typeof useThinCard>;

const DISMISSED_KEY = 'junksnap.thinCard';

// Springs in the first time it shows only; coming back from under a pin card or a sheet it simply appears.
function useFirstShow(shown: boolean): boolean {
  const [state, setState] = useState({ shown: false, enter: true });
  if (state.shown !== shown) setState({ shown, enter: state.enter && shown });
  return state.shown === shown ? state.enter : state.enter && shown;
}

/**
 * The few-reports card on phones: the thin view while nothing covers the map foot (a pin card, an area card, a
 * sheet or the list), until it is dismissed for the browser session. While it is up, the toast leaves "no reports
 * here" to it; on desktop and once dismissed the toast says it as before.
 */
export function useThinCard(page: CardSources, phone: boolean) {
  const [store] = useState(() => new BrowserStore(() => window.sessionStorage));
  const [dismissed, setDismissed] = useState(() => store.getItem(DISMISSED_KEY) !== null);
  const dismiss = useCallback(() => {
    store.setItem(DISMISSED_KEY, 'dismissed');
    setDismissed(true);
  }, [store]);
  const covered = page.sheetOpen || page.selection.preview !== null || Boolean(page.areaCard.area);
  const shown: ThinState | null = !phone || dismissed || covered ? null : page.thin;
  const enter = useFirstShow(shown !== null);
  return { shown, enter, dismiss, notice: shown ? MapNotice.besideCard(page.notice) : page.notice };
}
