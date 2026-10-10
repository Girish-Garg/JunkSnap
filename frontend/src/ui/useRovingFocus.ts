import { useRef, useState, type KeyboardEvent } from 'react';

const ITEM_ATTRIBUTE = 'data-roving-index';

// Arrow keys step one item, Home and End jump to the ends; any other key is left alone.
function target(key: string, active: number, count: number): number | null {
  const moves: Readonly<Record<string, number>> = { ArrowDown: active + 1, ArrowUp: active - 1, Home: 0, End: count - 1 };
  const next = moves[key];
  return next === undefined ? null : Math.min(Math.max(next, 0), count - 1);
}

/**
 * Roving focus for a list of buttons: Tab enters the list once, on the last item used, and the arrow keys,
 * Home and End move between items. Give the list `onKeyDown` and each item `itemProps(index)`.
 */
export function useRovingFocus(count: number, initial = 0) {
  const [active, setActive] = useState(initial);
  const list = useRef<HTMLUListElement>(null);
  const current = Math.min(active, Math.max(count - 1, 0));
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const next = target(event.key, current, count);
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    list.current?.querySelector<HTMLElement>(`[${ITEM_ATTRIBUTE}="${next}"]`)?.focus();
  };
  const itemProps = (index: number) => ({
    [ITEM_ATTRIBUTE]: index,
    tabIndex: index === current ? 0 : -1,
    onFocus: () => setActive(index),
  });
  return { list, onKeyDown, itemProps };
}
