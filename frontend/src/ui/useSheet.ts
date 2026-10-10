import { useEffect, useState, type Dispatch, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type RefObject } from 'react';
import { SheetDetents, type Detent } from './SheetDetents';
import { SheetDrag } from './SheetDrag';
import type { GestureOrigin } from './SheetGesture';
import { TYPING_FIELDS } from './useTypingLayer';

const KEY_STEPS: Readonly<Record<string, 1 | -1>> = { ArrowUp: 1, ArrowDown: -1 };

// Once a drag has started, the touch moves the sheet only: the content must not scroll along with it.
// A passive React listener cannot cancel touchmove, so this one is added by hand.
function useTouchGuard(sheet: RefObject<HTMLElement | null>, drag: SheetDrag): void {
  useEffect(() => {
    const element = sheet.current;
    if (!element) return undefined;
    const guard = (event: TouchEvent) => {
      if (drag.dragging() && event.cancelable) event.preventDefault();
    };
    element.addEventListener('touchmove', guard, { passive: false });
    return () => element.removeEventListener('touchmove', guard);
  }, [sheet, drag]);
}

function bodyProps(drag: SheetDrag, detent: Detent, setDetent: Dispatch<Detent>) {
  return {
    ...pointerProps(drag, 'body', detent),
    // The click that ends a drag over a row must not also open it.
    onClickCapture: (event: MouseEvent) => {
      if (drag.consumeDrag(event.timeStamp)) event.stopPropagation();
    },
    onClick: () => {
      if (detent === 'peek') setDetent('half');
    },
    // Typing opens the keyboard, which takes half the screen: the sheet goes full so the field stays in view.
    onFocusCapture: (event: FocusEvent) => {
      if (event.target.matches(TYPING_FIELDS) && !SheetDrag.sidePanel()) setDetent('full');
    },
  };
}

function pointerProps(drag: SheetDrag, origin: GestureOrigin, detent: Detent) {
  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => drag.begin(event, origin, detent),
    onPointerMove: (event: PointerEvent<HTMLElement>) => drag.move(event),
    onPointerUp: (event: PointerEvent<HTMLElement>) => drag.end(event),
    onPointerCancel: () => drag.cancel(),
  };
}

/** A sheet's height (peek, half, full) and its drag: from the handle bar, or down from content scrolled to the top. */
export function useSheet(initial: Detent, sheet: RefObject<HTMLElement | null>, onDismiss: () => void) {
  const [detent, setDetent] = useState<Detent>(initial);
  const [drag] = useState(() => new SheetDrag());
  useEffect(() => drag.bind({ onSettle: setDetent, onDismiss }), [drag, onDismiss]);
  useTouchGuard(sheet, drag);
  return {
    detent,
    barProps: pointerProps(drag, 'bar', detent),
    bodyProps: bodyProps(drag, detent, setDetent),
    onHandleClick: (event: MouseEvent) => {
      if (!drag.consumeDrag(event.timeStamp)) setDetent(SheetDetents.cycle(detent));
    },
    onHandleKey: (event: KeyboardEvent) => {
      const direction = KEY_STEPS[event.key];
      if (!direction) return;
      event.preventDefault();
      setDetent(SheetDetents.step(detent, direction));
    },
  };
}
