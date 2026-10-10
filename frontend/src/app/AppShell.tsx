import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ToastHost } from '../features/actions/components/ToastHost';
import { useConnectionToasts } from '../features/actions/hooks/useConnectionToasts';
import { AuthFlowProvider } from '../features/auth/components/AuthFlowProvider';
import { SplashScreen } from '../features/brand/components/SplashScreen';
import { SplashSession } from '../features/brand/SplashSession';
import { ConfirmToast } from '../features/snap/components/ConfirmToast';
import { RejectionToast } from '../features/snap/components/RejectionToast';
import { AppRoutes } from './AppRoutes';
import { WELCOME_PATH } from './paths';
import { SheetHistory } from './SheetHistory';
import { useAppLinks } from './useAppLinks';
import { useDocumentLang } from './useDocumentLang';
import { useServices } from './useServices';

export function AppShell() {
  const { onboarding } = useServices();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [session] = useState(() => new SplashSession(() => window.sessionStorage));
  const [splash, setSplash] = useState(() => session.due());
  useAppLinks();
  useConnectionToasts();
  useDocumentLang();
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
      <ConfirmToast />
      <ToastHost />
      {splash && <SplashScreen onDone={afterSplash} />}
    </div>
  );
}
