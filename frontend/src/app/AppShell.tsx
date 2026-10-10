import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { AuthFlowProvider } from '../features/auth/components/AuthFlowProvider';
import { SplashScreen } from '../features/brand/components/SplashScreen';
import { SplashSession } from '../features/brand/SplashSession';
import { RejectionToast } from '../features/snap/components/RejectionToast';
import { AppRoutes } from './AppRoutes';
import { WELCOME_PATH } from './paths';
import { SheetHistory } from './SheetHistory';
import { useServices } from './useServices';

export function AppShell() {
  const { i18n } = useTranslation();
  const { onboarding } = useServices();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [session] = useState(() => new SplashSession(() => window.sessionStorage));
  const [splash, setSplash] = useState(() => session.due());
  useEffect(() => {
    // Screen readers and the :lang(hi) font rule read this.
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);
  // First visit at the map: the "How JunkSnap works" cards open once, above the map, after the splash.
  const afterSplash = useCallback(() => {
    setSplash(false);
    session.played();
    if (!onboarding.seen() && pathname === '/') navigate(WELCOME_PATH, { state: SheetHistory.above(0) });
  }, [onboarding, pathname, navigate, session]);
  return (
    <div className="app">
      <AuthFlowProvider>
        <AppRoutes />
      </AuthFlowProvider>
      <RejectionToast />
      {splash && <SplashScreen onDone={afterSplash} />}
    </div>
  );
}
