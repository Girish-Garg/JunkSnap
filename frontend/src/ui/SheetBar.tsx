import { IconButton } from './IconButton';
import type { useSheet } from './useSheet';

interface SheetBarProps {
  readonly sheet: ReturnType<typeof useSheet>;
  readonly closeLabel: string;
  readonly resizeLabel: string;
  readonly onClose: () => void;
}

/** The drag handle (tap or arrow keys to resize) and the close button. */
export function SheetBar({ sheet, closeLabel, resizeLabel, onClose }: SheetBarProps) {
  return (
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
  );
}
