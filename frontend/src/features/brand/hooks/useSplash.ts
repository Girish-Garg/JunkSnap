import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { InertOutside } from '../../../ui/InertOutside';

// The parts play for 800 ms (splash.css), then the mark flies into the logo's place in 350 ms.
const PARTS_MS = 800;
const FLY_MS = 350;
const STATIC_MS = 450;
const TARGETS = '.searchbar__lead .logo__mark, .nav-bar__brand .logo__mark';

function moving(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
}

// The visible logo the mark shrinks into: the search field's on phones, the panel head's on desktop.
function target(): DOMRect | null {
  const found = [...document.querySelectorAll<HTMLElement>(TARGETS)].find((element) => element.getClientRects().length > 0);
  return found?.getBoundingClientRect() ?? null;
}

function fly(mark: SVGSVGElement, screen: HTMLElement): Animation {
  const from = mark.getBoundingClientRect();
  const to = target() ?? from;
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const move = [{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${to.width / from.width})` }];
  screen.animate([{ backgroundColor: getComputedStyle(screen).backgroundColor }, { backgroundColor: 'transparent' }], {
    duration: FLY_MS,
    fill: 'forwards',
  });
  return mark.animate(move, { duration: FLY_MS, easing: 'cubic-bezier(0.55, 0, 0.2, 1)', fill: 'forwards' });
}

/** Runs the start-up splash once; a tap or key skips it. Reduced motion shows the mark still, briefly. */
export function useSplash(screen: RefObject<HTMLElement | null>, mark: RefObject<SVGSVGElement | null>, onDone: () => void) {
  const done = useRef(false);
  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onDone();
  }, [onDone]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!moving() || !mark.current || !screen.current) return finish();
      fly(mark.current, screen.current).finished.then(finish, finish);
    }, moving() ? PARTS_MS : STATIC_MS);
    window.addEventListener('keydown', finish);
    // While it plays, the app underneath cannot take focus.
    const release = screen.current ? InertOutside.mark(screen.current) : undefined;
    return () => {
      release?.();
      window.clearTimeout(timer);
      window.removeEventListener('keydown', finish);
    };
  }, [finish, mark, screen]);
  return finish;
}
