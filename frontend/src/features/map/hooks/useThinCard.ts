import { useCallback, useState } from 'react';
import type { ThinState } from '../../../domain/ThinView';
import { BrowserStore } from '../../../services/BrowserStore';
import type { MapPageState } from './useMapPage';

type CardSources = Pick<MapPageState, 'thin' | 'sheetOpen' | 'selection' | 'areaCard'>;

const DISMISSED_KEY = 'junksnap.thinCard';

/**
 * The few-reports card's state: the thin view while nothing covers the map foot (a pin card, an area card, a
 * sheet or the list), until it is dismissed for the browser session (sessionStorage, or memory if it is blocked).
 */
export function useThinCard({ thin, sheetOpen, selection, areaCard }: CardSources) {
  const [store] = useState(() => new BrowserStore(() => window.sessionStorage));
  const [dismissed, setDismissed] = useState(() => store.getItem(DISMISSED_KEY) !== null);
  const dismiss = useCallback(() => {
    store.setItem(DISMISSED_KEY, 'dismissed');
    setDismissed(true);
  }, [store]);
  const covered = sheetOpen || selection.preview !== null || Boolean(areaCard.area);
  const shown: ThinState | null = dismissed || covered ? null : thin;
  return { shown, dismiss };
}
