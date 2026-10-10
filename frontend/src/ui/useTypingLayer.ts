import { useCallback, useEffect, useState, type RefObject } from 'react';
import { useHistoryLayer } from './useHistoryLayer';
import { DESKTOP_QUERY, useMediaQuery } from './useMediaQuery';

/** Fields that bring up the keyboard (not switches, radios or sliders). */
export const TYPING_FIELDS = 'textarea, input:not([type=checkbox], [type=radio], [type=range], [type=button], [type=submit])';

// The visible area grows by at least this much when the soft keyboard goes away.
const KEYBOARD_PX = 150;

function isTyping(target: EventTarget | null): boolean {
  return target instanceof Element && target.matches(TYPING_FIELDS);
}

function releaseField(sheet: RefObject<HTMLElement | null>): void {
  const field = document.activeElement;
  if (field instanceof HTMLElement && isTyping(field) && sheet.current?.contains(field)) field.blur();
}

// The keyboard shrinks the visual viewport in a browser (the page keeps its size) and the whole window in the
// Android app (the WebView resizes); the visual viewport follows both.
function visibleHeight(): number {
  return window.visualViewport?.height ?? window.innerHeight;
}

// Android hides the keyboard on the first back press without telling the page, and the field keeps focus.
// When the visible area grows back, the field is let go too, so the bottom bar returns. Phones only.
function useKeyboardClose(release: () => void, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return undefined;
    const target = window.visualViewport ?? window;
    let height = visibleHeight();
    const onResize = () => {
      if (visibleHeight() - height > KEYBOARD_PX) release();
      height = visibleHeight();
    };
    target.addEventListener('resize', onResize);
    return () => target.removeEventListener('resize', onResize);
  }, [release, enabled]);
}

/**
 * On phones, a text field in the sheet with the keyboard up is one more level: back and Escape first let go
 * of the field (and its keyboard), so a half-written note is not lost with the whole sheet. Desktop has no
 * soft keyboard, so there Escape and back close the sheet as before.
 */
export function useTypingLayer(sheet: RefObject<HTMLElement | null>) {
  const phone = !useMediaQuery(DESKTOP_QUERY);
  const [focused, setFocused] = useState(false);
  const typing = focused && phone;
  const release = useCallback(() => releaseField(sheet), [sheet]);
  useHistoryLayer('typing', typing, release);
  useKeyboardClose(release, phone);
  useEffect(() => {
    const element = sheet.current;
    if (!element) return undefined;
    const onFocusIn = (event: FocusEvent) => setFocused(isTyping(event.target));
    const onFocusOut = () => setFocused(false);
    element.addEventListener('focusin', onFocusIn);
    element.addEventListener('focusout', onFocusOut);
    return () => {
      element.removeEventListener('focusin', onFocusIn);
      element.removeEventListener('focusout', onFocusOut);
    };
  }, [sheet]);
  return { typing, release };
}
