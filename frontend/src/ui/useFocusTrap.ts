import { useEffect, useLayoutEffect, type RefObject } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/** Keeps Tab inside a modal layer, focuses its first control on open and gives focus back on close. */
export function useFocusTrap(layer: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    layer.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [layer]);

  useEffect(() => {
    const element = layer.current;
    if (!element) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = [...element.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const edge = event.shiftKey ? items[0] : items[items.length - 1];
      if (document.activeElement !== edge && element.contains(document.activeElement)) return;
      event.preventDefault();
      (event.shiftKey ? items[items.length - 1] : items[0])?.focus();
    };
    // On the document, so Tab is caught even when a tap on the photo left focus on <body>.
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [layer]);
}
