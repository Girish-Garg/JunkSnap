import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { SplashSession } from '../features/brand/SplashSession';
import { WELCOME_PATH } from './paths';
import { SheetHistory } from './SheetHistory';
import { useServices } from './useServices';

export interface StartScreens {
  /** The splash plays (once per browser session). */
  readonly splash: boolean;
  /** The splash's end: on a first visit at the map, the "How JunkSnap works" cards open above it. */
  readonly afterSplash: () => void;
  /** Neither the splash nor the first-run cards are up, or on their way. */
  readonly clear: boolean;
}

/**
 * The splash, then on a first visit at the map the "How JunkSnap works" cards, once each. The router shows the cards
 * a render after the splash ends (its updates are transitions), so `cardsDue` keeps `clear` false in between.
 */
export function useStartScreens(): StartScreens {
  const { onboarding } = useServices();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [session] = useState(() => new SplashSession(() => window.sessionStorage));
  const [splash, setSplash] = useState(() => session.due());
  const [cardsDue, setCardsDue] = useState(false);
  // The cards were sent from the bare map: once the router has moved on (to them, or a link won), the path tells.
  if (cardsDue && pathname !== '/') setCardsDue(false);
  const afterSplash = useCallback(() => {
    setSplash(false);
    session.played();
    if (onboarding.seen() || pathname !== '/') return;
    setCardsDue(true);
    navigate(WELCOME_PATH, { state: SheetHistory.above(0) });
  }, [onboarding, pathname, navigate, session]);
  return { splash, afterSplash, clear: !splash && !cardsDue && pathname !== WELCOME_PATH };
}
