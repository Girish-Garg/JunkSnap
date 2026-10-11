import type { AppConfig } from './AppConfig';
import { useServices } from './useServices';

/** The build's configuration (AppConfig), for hooks and components; services get it from the ServiceContainer. */
export function useConfig(): AppConfig {
  return useServices().config;
}
