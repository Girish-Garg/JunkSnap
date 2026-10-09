import { createContext } from 'react';
import type { ServiceContainer } from './ServiceContainer';

export const ServicesContext = createContext<ServiceContainer | null>(null);
