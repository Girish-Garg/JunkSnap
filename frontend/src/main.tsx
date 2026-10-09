import '@fontsource/noto-sans/latin-400.css';
import '@fontsource/noto-sans/latin-600.css';
import '@fontsource/noto-sans-devanagari/devanagari-400.css';
import '@fontsource/noto-sans-devanagari/devanagari-600.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import './ui/theme.css';
import { setWorkerUrl } from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AppConfig } from './app/AppConfig';
import { ServiceContainer } from './app/ServiceContainer';
import { BrowserStore } from './services/BrowserStore';
import { QueueTriggers } from './services/QueueTriggers';

// MapLibre looks for its worker next to its own file, which Vite relocates.
setWorkerUrl(mapWorkerUrl);

const services = ServiceContainer.build(AppConfig.fromEnv(import.meta.env), {
  store: new BrowserStore(() => window.localStorage),
  geolocation: navigator.geolocation,
  share: navigator,
  mediaDevices: navigator.mediaDevices,
  crypto: window.crypto,
  locks: navigator.locks,
});
// Saved reports start sending as soon as the app opens; the sign-in (if any) is read first.
void services.auth.restore().finally(() => {
  new QueueTriggers(services.snap.queue, { window, document, auth: services.auth }).start();
});
const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root element');

createRoot(root).render(
  <StrictMode>
    <App services={services} />
  </StrictMode>,
);
