import { useCallback, useRef, type CSSProperties, type ReactNode } from 'react';
import './sheet.css';
import { SheetBar } from './SheetBar';
import { SheetDetents, type Detent } from './SheetDetents';
import { useExitAnimation } from './useExitAnimation';
import { ESCAPE_LAYER, useEscapeKey } from './useEscapeKey';
import { useSheet } from './useSheet';
import { useSheetFocus } from './useSheetFocus';
import { useTypingLayer } from './useTypingLayer';

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

/**
 * Springs up from the bottom and slides away on close; a left side panel on desktop instead (sheet.css).
 * On phones it follows the finger: drag the bar, or drag down from content scrolled to the top, to change its
 * height; drag it below the peek height or throw it down to close it. Escape and a map tap close it too, once
 * a text field in it has let go of the keyboard.
 */
export function BottomSheet({ labelledBy, closeLabel, resizeLabel, onClose, children, initial, focusKey }: BottomSheetProps) {
  const layer = useRef<HTMLElement>(null);
  const exit = useExitAnimation(onClose);
  const sheet = useSheet(initial ?? 'half', layer, exit.close);
  const typing = useTypingLayer(layer);
  // While a field has the keyboard, Escape and a map tap first let go of the field, as back does.
  const { close } = exit;
  const escape = useCallback(() => (typing.typing ? typing.release() : close()), [typing, close]);
  useEscapeKey(escape, layer);
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
      <div className="sheet__body" {...sheet.bodyProps}>
        {children}
      </div>
    </aside>
  );
}
