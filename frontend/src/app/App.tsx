import { I18nextProvider } from 'react-i18next';
import { BrowserRouter } from 'react-router';
import { AppShell } from './AppShell';
import type { ServiceContainer } from './ServiceContainer';
import { ServicesContext } from './ServicesContext';

interface AppProps {
  readonly services: ServiceContainer;
}

export function App({ services }: AppProps) {
  return (
    <ServicesContext.Provider value={services}>
      <I18nextProvider i18n={services.localization.i18n}>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </I18nextProvider>
    </ServicesContext.Provider>
  );
}
