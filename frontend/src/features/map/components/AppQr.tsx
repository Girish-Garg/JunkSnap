import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';

// uqr loads only when the desktop dialog opens; phones never download it.
const QrCode = lazy(() => import('../../../ui/QrCode'));

/** A QR code of this app's address, for the phone to open. */
export function AppQr() {
  const { t } = useTranslation();
  return (
    <div className="dialog__qr">
      <Suspense fallback={<span className="skeleton dialog__qr-wait" />}>
        <QrCode text={window.location.origin} label={t('desktop.qrLabel')} />
      </Suspense>
    </div>
  );
}
