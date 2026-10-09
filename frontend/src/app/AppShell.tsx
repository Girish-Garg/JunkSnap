import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthFlowProvider } from '../features/auth/components/AuthFlowProvider';
import { AppRoutes } from './AppRoutes';

export function AppShell() {
  const { i18n } = useTranslation();
  useEffect(() => {
    // Screen readers and the :lang(hi) font rule read this.
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);
  return (
    <div className="app">
      <AuthFlowProvider>
        <AppRoutes />
      </AuthFlowProvider>
    </div>
  );
}
