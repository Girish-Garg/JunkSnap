import { useLayoutEffect, type RefObject } from 'react';
import { InertOutside } from './InertOutside';

/**
 * Makes everything outside a modal dialog inert while it is open, so keyboard and screen-reader users stay
 * inside it. Elements added later (the sign-in sheet opened from the dialog) stay usable.
 * A layout effect, called before useSheetFocus: React undoes layout effects in call order on close, so the page
 * is usable again before focus goes back to the opener (a browser ignores focus() inside an inert subtree).
 */
export function useInertOutside(dialog: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => (dialog.current ? InertOutside.mark(dialog.current) : undefined), [dialog]);
}
