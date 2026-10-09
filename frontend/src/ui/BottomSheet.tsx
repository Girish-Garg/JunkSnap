import type { CSSProperties, ReactNode } from 'react';
import { IconButton } from './IconButton';
import './sheet.css';
import { SheetDetents, type Detent } from './SheetDetents';
import { useEscapeKey } from './useEscapeKey';
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

/** A left side panel on desktop instead (sheet.css). */
export function BottomSheet({ labelledBy, closeLabel, resizeLabel, onClose, children, initial, focusKey }: BottomSheetProps) {
  const sheet = useSheet(initial ?? 'half');
  useEscapeKey(onClose);
  useSheetFocus(labelledBy, focusKey);
  const height = { '--sheet-height': SheetDetents.css(sheet.detent) } as CSSProperties;
  return (
    <aside className={`sheet sheet--${sheet.detent}`} style={height} aria-labelledby={labelledBy}>
      <div className="sheet__bar" {...sheet.barProps}>
        <button
          type="button"
          className="sheet__handle"
          aria-label={resizeLabel}
          aria-expanded={sheet.detent === 'full'}
          onClick={sheet.onHandleClick}
          onKeyDown={sheet.onHandleKey}
        >
          <span className="sheet__grip" />
        </button>
        <IconButton icon="close" label={closeLabel} onClick={onClose} />
      </div>
      <div className="sheet__body" onClick={sheet.expandFromPeek}>
        {children}
      </div>
    </aside>
  );
}
