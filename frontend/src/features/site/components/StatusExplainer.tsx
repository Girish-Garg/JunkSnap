import { useId, useRef, type ReactNode, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { ChipView } from '../../../domain/SiteStatusChip';
import { IconButton } from '../../../ui/IconButton';
import { ESCAPE_LAYER, useEscapeKey } from '../../../ui/useEscapeKey';
import { useHistoryLayer } from '../../../ui/useHistoryLayer';
import { useInertOutside } from '../../../ui/useInertOutside';
import { useSheetFocus } from '../../../ui/useSheetFocus';
import '../explainer.css';

interface StatusExplainerProps {
  readonly chip: ChipView;
  /** The plain words for this site's status (SitePresenter.explainKey). */
  readonly textKey: string;
  readonly onClose: () => void;
  /** What the person can do next, such as Ask neighbours to confirm. */
  readonly children?: ReactNode;
}

// React passes a portal's events up to its parents; the pin card under this would read a tap as View site.
const stop = (event: SyntheticEvent) => event.stopPropagation();
const KEEP_EVENTS = { onPointerDown: stop, onPointerMove: stop, onPointerUp: stop, onPointerCancel: stop };

/**
 * What a status chip means in plain words, in one or two sentences, as a small card over everything. It is one
 * history level: close, back, Escape and a tap outside close it, and focus returns to the chip.
 */
export function StatusExplainer({ chip, textKey, onClose, children }: StatusExplainerProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const layer = useRef<HTMLDivElement>(null);
  const dismiss = useHistoryLayer('explain', true, onClose);
  const close = () => dismiss();
  const closeOutside = (event: SyntheticEvent) => {
    stop(event);
    close();
  };
  useEscapeKey(close, layer);
  useInertOutside(layer);
  useSheetFocus(titleId, chip.key);
  const card = (
    <div className="explainer-scrim" onClick={closeOutside} {...KEEP_EVENTS}>
      <div ref={layer} className="explainer" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={stop} {...{ [ESCAPE_LAYER]: '' }}>
        <div className="explainer__head">
          <h2 id={titleId} className={`status-chip status-chip--${chip.tone}`} tabIndex={-1}>
            {t(chip.key, chip.params)}
          </h2>
          <IconButton icon="close" label={t('explain.close')} onClick={close} />
        </div>
        <p>{t(textKey, chip.params)}</p>
        {children}
      </div>
    </div>
  );
  return createPortal(card, document.body);
}
