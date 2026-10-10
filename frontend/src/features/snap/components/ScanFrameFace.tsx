import { useTranslation } from 'react-i18next';
import type { FrameFinding } from '../../../domain/ScanUpload';
import { Icon } from '../../../ui/Icon';

/** A frame's blurred thumbnail (or a camera placeholder) over its result. */
export function ScanFrameFace({ frame }: { readonly frame: FrameFinding }) {
  const { t } = useTranslation();
  const at = t('scan.frameAt', { seconds: Math.round(frame.t_ms / 1000) });
  return (
    <>
      {frame.blurred_url ? (
        <img className="scan-frame__thumb" src={frame.blurred_url} alt={at} loading="lazy" />
      ) : (
        <span className="scan-frame__thumb scan-frame__thumb--missing" role="img" aria-label={at}>
          <Icon name="camera" size={16} />
        </span>
      )}
      <span className="scan-frame__result">{t(`scan.frameResult.${frame.result}`)}</span>
    </>
  );
}
