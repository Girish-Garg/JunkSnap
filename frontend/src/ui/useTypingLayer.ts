import { useCallback, useEffect, useState, type RefObject } from 'react';
import { useHistoryLayer } from './useHistoryLayer';

/** Fields that bring up the keyboard (not switches, radios or sliders). */
export const TYPING_FIELDS = 'textarea, input:not([type=checkbox], [type=radio], [type=range], [type=button], [type=submit])';

// The window grows by at least this much when the soft keyboard goes away.
const KEYBOARD_PX = 150;

function isTyping(target: EventTarget | null): boolean {
  return target instanceof Element && target.matches(TYPING_FIELDS);
}

function releaseField(sheet: RefObject<HTMLElement | null>): void {
  const field = document.activeElement;
  if (field instanceof HTMLElement && isTyping(field) && sheet.current?.contains(field)) field.blur();
}

// Android hides the keyboard on the first back press without telling the page, and the field keeps focus.
// When the window grows back, the field is let go too, so the bottom bar returns.
function useKeyboardClose(release: () => void): void {
  useEffect(() => {
    let height = window.innerHeight;
    const onResize = () => {
      if (window.innerHeight - height > KEYBOARD_PX) release();
      height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [release]);
}

/**
 * While a text field in the sheet has focus, it is one more level: back and Escape first let go of the field
 * (and its keyboard), so a half-written note is not lost with the whole sheet.
 */
export function useTypingLayer(sheet: RefObject<HTMLElement | null>) {
  const [typing, setTyping] = useState(false);
  const release = useCallback(() => releaseField(sheet), [sheet]);
  useHistoryLayer('typing', typing, release);
  useKeyboardClose(release);
  useEffect(() => {
    const element = sheet.current;
    if (!element) return undefined;
    const onFocusIn = (event: FocusEvent) => setTyping(isTyping(event.target));
    const onFocusOut = () => setTyping(false);
    element.addEventListener('focusin', onFocusIn);
    element.addEventListener('focusout', onFocusOut);
    return () => {
      element.removeEventListener('focusin', onFocusIn);
      element.removeEventListener('focusout', onFocusOut);
    };
  }, [sheet]);
  return { typing, release };
}
