import type { CSSProperties, ReactNode } from 'react';
import { IconButton } from './IconButton';
import './sheet.css';
import { SheetDetents } from './SheetDetents';
import { useEscapeKey } from './useEscapeKey';
import { useSheet } from './useSheet';

interface BottomSheetProps {
  readonly labelledBy: string;
  readonly closeLabel: string;
  readonly resizeLabel: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

/** A left side panel on desktop instead (sheet.css). */
export function BottomSheet({ labelledBy, closeLabel, resizeLabel, onClose, children }: BottomSheetProps) {
  const sheet = useSheet('half');
  useEscapeKey(onClose);
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
