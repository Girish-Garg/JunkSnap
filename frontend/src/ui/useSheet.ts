import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import { SheetDetents, type Detent } from './SheetDetents';
import { SheetDrag } from './SheetDrag';

const KEY_STEPS: Readonly<Record<string, 1 | -1>> = { ArrowUp: 1, ArrowDown: -1 };

export function useSheet(initial: Detent) {
  const [detent, setDetent] = useState<Detent>(initial);
  const [drag] = useState(() => new SheetDrag(setDetent));
  return {
    detent,
    barProps: {
      onPointerDown: (event: PointerEvent<HTMLElement>) => drag.begin(event, detent),
      onPointerMove: (event: PointerEvent<HTMLElement>) => drag.move(event),
      onPointerUp: (event: PointerEvent<HTMLElement>) => drag.end(event),
      onPointerCancel: (event: PointerEvent<HTMLElement>) => drag.end(event),
    },
    onHandleClick: () => {
      if (!drag.consumeDrag()) setDetent(SheetDetents.cycle(detent));
    },
    onHandleKey: (event: KeyboardEvent) => {
      const direction = KEY_STEPS[event.key];
      if (!direction) return;
      event.preventDefault();
      setDetent(SheetDetents.step(detent, direction));
    },
    expandFromPeek: () => {
      if (detent === 'peek') setDetent('half');
    },
  };
}
