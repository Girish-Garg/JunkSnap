import { useContext } from 'react';
import { JunkSnapError } from '../domain/JunkSnapError';
import type { ServiceContainer } from './ServiceContainer';
import { ServicesContext } from './ServicesContext';

export function useServices(): ServiceContainer {
  const services = useContext(ServicesContext);
  if (!services) throw new JunkSnapError('useServices must be used inside <App>');
  return services;
}
