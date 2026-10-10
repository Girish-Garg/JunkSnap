import { useEffect, type RefObject } from 'react';
import { InertOutside } from './InertOutside';

/**
 * Makes everything outside a modal dialog inert while it is open, so keyboard and screen-reader users stay
 * inside it. Elements added later (the sign-in sheet opened from the dialog) stay usable.
 */
export function useInertOutside(dialog: RefObject<HTMLElement | null>): void {
  useEffect(() => (dialog.current ? InertOutside.mark(dialog.current) : undefined), [dialog]);
}
