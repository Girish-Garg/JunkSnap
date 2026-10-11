import { ToastHost } from '../features/actions/components/ToastHost';
import { useConnectionToasts } from '../features/actions/hooks/useConnectionToasts';
import { AuthFlowProvider } from '../features/auth/components/AuthFlowProvider';
import { SplashScreen } from '../features/brand/components/SplashScreen';
import { ConfirmToast } from '../features/snap/components/ConfirmToast';
import { RejectionToast } from '../features/snap/components/RejectionToast';
import { ToastStack } from '../ui/ToastStack';
import { AppRoutes } from './AppRoutes';
import { useAppLinks } from './useAppLinks';
import { useDocumentLang } from './useDocumentLang';
import { useStartScreens } from './useStartScreens';
import { useStartupLocation } from './useStartupLocation';

export function AppShell() {
  const start = useStartScreens();
  useAppLinks();
  useConnectionToasts();
  useDocumentLang();
  // One location fix per launch, after the splash and the first-run cards, so a prompt never shows on top of them.
  useStartupLocation(start.clear);
  return (
    <div className="app">
      <ToastStack>
        <AuthFlowProvider>
          <AppRoutes />
        </AuthFlowProvider>
        <RejectionToast />
        <ConfirmToast />
        <ToastHost />
      </ToastStack>
      {start.splash && <SplashScreen onDone={start.afterSplash} />}
    </div>
  );
}
