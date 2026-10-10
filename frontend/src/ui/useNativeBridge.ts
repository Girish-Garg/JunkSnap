import { useMemo } from 'react';
import { NativeBridge } from '../services/NativeBridge';

/** The Android app's native bridge (print, share, app settings); inert in a browser. */
export function useNativeBridge(): NativeBridge {
  return useMemo(() => new NativeBridge(window), []);
}

/** Inside the Android app a blocked permission is allowed again in the app's settings, not the browser's. */
export function useInAppKey(key: string, appKey: string): string {
  return useNativeBridge().canOpenAppSettings() ? appKey : key;
}

/** Text about the browser (its settings, its hardware acceleration) has an app version for inside the Android app. */
export function useAppTextKey(key: string, appKey: string): string {
  return useNativeBridge().inApp() ? appKey : key;
}
