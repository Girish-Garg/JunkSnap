import { useTranslation } from 'react-i18next';
import type { FrameFinding } from '../../../domain/ScanUpload';
import { Icon } from '../../../ui/Icon';
import './scan-frames.css';

/** One blurred thumbnail per frame the worker cut, each with what became of it. */
export function ScanFrameStrip({ frames }: { readonly frames: readonly FrameFinding[] }) {
  const { t } = useTranslation();
  if (frames.length === 0) return null;
  return (
    <ul className="scan-frames" aria-label={t('scan.framesLabel')}>
      {frames.map((frame) => {
        const at = t('scan.frameAt', { seconds: Math.round(frame.t_ms / 1000) });
        return (
          <li key={frame.report_id} className={`scan-frame scan-frame--${frame.result}`}>
            {frame.blurred_url ? (
              <img className="scan-frame__thumb" src={frame.blurred_url} alt={at} loading="lazy" />
            ) : (
              <span className="scan-frame__thumb scan-frame__thumb--missing" role="img" aria-label={at}>
                <Icon name="camera" size={16} />
              </span>
            )}
            <span className="scan-frame__result">{t(`scan.frameResult.${frame.result}`)}</span>
          </li>
        );
      })}
    </ul>
  );
}
