import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../../ui/Icon';
import { IconButton } from '../../../ui/IconButton';
import { ESCAPE_LAYER, useEscapeKey } from '../../../ui/useEscapeKey';
import { useHistoryLayer } from '../../../ui/useHistoryLayer';
import { useInertOutside } from '../../../ui/useInertOutside';
import { useSheetFocus } from '../../../ui/useSheetFocus';
import { AppQr } from './AppQr';
import { PhoneDialogFooter } from './PhoneDialogFooter';

const TITLE_ID = 'phone-title';

export type PhoneTask = 'report' | 'scan';

interface PhoneDialogProps {
  readonly task: PhoneTask;
  readonly onClose: () => void;
}

/** Desktop: Snap and Scan need a phone's camera and GPS, so this hands the app over with a QR code. */
export function PhoneDialog({ task, onClose }: PhoneDialogProps) {
  const { t } = useTranslation();
  const layer = useRef<HTMLDivElement>(null);
  const dismiss = useHistoryLayer('phone', true, onClose);
  const close = () => dismiss();
  useEscapeKey(close, layer);
  useInertOutside(layer);
  useSheetFocus(TITLE_ID, task);
  return (
    <div className="dialog-scrim" onClick={close}>
      <div ref={layer} className="dialog" role="dialog" aria-modal="true" aria-labelledby={TITLE_ID} onClick={(event) => event.stopPropagation()} {...{ [ESCAPE_LAYER]: '' }}>
        <div className="dialog__close">
          <IconButton icon="close" label={t('desktop.close')} onClick={close} />
        </div>
        <span className="dialog__badge">
          <Icon name="phone" size={28} />
        </span>
        <h2 id={TITLE_ID} className="sheet-title" tabIndex={-1}>
          {t(`desktop.${task}Title`)}
        </h2>
        <p className="sheet-text">{t(`desktop.${task}Text`)}</p>
        <AppQr />
        <p className="dialog__url">{window.location.host}</p>
        <PhoneDialogFooter />
      </div>
    </div>
  );
}
