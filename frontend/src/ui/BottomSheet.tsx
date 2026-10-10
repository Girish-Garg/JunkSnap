import { useRef, type CSSProperties, type ReactNode } from 'react';
import './sheet.css';
import { SheetBar } from './SheetBar';
import { SheetDetents, type Detent } from './SheetDetents';
import { useExitAnimation } from './useExitAnimation';
import { ESCAPE_LAYER, useEscapeKey } from './useEscapeKey';
import { useSheet } from './useSheet';
import { useSheetFocus } from './useSheetFocus';

interface BottomSheetProps {
  readonly labelledBy: string;
  readonly closeLabel: string;
  readonly resizeLabel: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly initial?: Detent;
  /** Refocus the title when this changes, e.g. once content has loaded. */
  readonly focusKey?: unknown;
}

/** Springs up from the bottom and slides away on close; a left side panel on desktop instead (sheet.css). */
export function BottomSheet({ labelledBy, closeLabel, resizeLabel, onClose, children, initial, focusKey }: BottomSheetProps) {
  const sheet = useSheet(initial ?? 'half');
  const layer = useRef<HTMLElement>(null);
  const exit = useExitAnimation(onClose);
  useEscapeKey(exit.close, layer);
  useSheetFocus(labelledBy, focusKey);
  const height = { '--sheet-height': SheetDetents.css(sheet.detent) } as CSSProperties;
  const escapeLayer = { [ESCAPE_LAYER]: '' };
  return (
    <aside
      ref={layer}
      className={`sheet sheet--${sheet.detent}${exit.closing ? ' sheet--closing' : ''}`}
      style={height}
      aria-labelledby={labelledBy}
      onAnimationEnd={exit.onAnimationEnd}
      {...escapeLayer}
    >
      <SheetBar sheet={sheet} closeLabel={closeLabel} resizeLabel={resizeLabel} onClose={exit.close} />
      <div className="sheet__body" onClick={sheet.expandFromPeek}>
        {children}
      </div>
    </aside>
  );
}
