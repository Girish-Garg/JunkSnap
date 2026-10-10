import { useTranslation } from 'react-i18next';
import { MarkerArt } from '../../../ui/MarkerArt';

// The map's own pin images at legend size: a lone site, an unverified one and a stack of several.
const PIN = MarkerArt.dataUrl('waste_dump', 20);
const UNVERIFIED = MarkerArt.dataUrl('waste_dump', 20, false, true);
const STACK = MarkerArt.stackDataUrl('waste_dump', 24);

/** The pins in words: one site, a site still waiting for its 10 backers (the n/10 sticker), and a stack. */
export function PinKey() {
  const { t } = useTranslation();
  return (
    <>
      <div className="boundary-legend__ramp">
        <img className="pin-key__pin" src={PIN} width={20} height={20} alt="" />
        <span>{t('legend.pin')}</span>
      </div>
      <div className="boundary-legend__ramp">
        <span className="pin-key__unverified" aria-hidden="true">
          <img src={UNVERIFIED} width={20} height={20} alt="" />
          <span className="pin-key__badge">1/10</span>
        </span>
        <span>{t('legend.unverified')}</span>
      </div>
      <div className="boundary-legend__ramp">
        <img className="pin-key__pin" src={STACK} width={24} height={24} alt="" />
        <span>{t('legend.stack')}</span>
      </div>
    </>
  );
}
