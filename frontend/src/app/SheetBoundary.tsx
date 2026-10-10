import type { ReactNode } from 'react';
import { useLocation } from 'react-router';
import { SheetCrash } from '../features/actions/components/SheetCrash';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { useServices } from './useServices';

/**
 * One per route sheet: a crash inside it shows "Something went wrong" with Try again, and the map and every other
 * sheet keep working. A new route starts with a fresh boundary.
 */
export function SheetBoundary({ children }: { readonly children: ReactNode }) {
  const { errors } = useServices();
  const { pathname } = useLocation();
  return (
    <ErrorBoundary key={pathname} onError={(error) => errors.report('sheet', error)} fallback={(retry) => <SheetCrash onRetry={retry} />}>
      {children}
    </ErrorBoundary>
  );
}
