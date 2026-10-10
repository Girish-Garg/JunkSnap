import { useTranslation } from 'react-i18next';
import type { FrameFinding } from '../../../domain/ScanUpload';
import { ScanFrameFace } from './ScanFrameFace';
import './scan-frames.css';

interface ScanFrameStripProps {
  readonly frames: readonly FrameFinding[];
  /** Opens a frame's "What we checked"; without it the frames are plain pictures. */
  readonly onOpen?: (reportId: string) => void;
}

/** One blurred thumbnail per frame the worker cut, each with what became of it. */
export function ScanFrameStrip({ frames, onOpen }: ScanFrameStripProps) {
  const { t } = useTranslation();
  if (frames.length === 0) return null;
  return (
    <ul className="scan-frames" aria-label={t('scan.framesLabel')}>
      {frames.map((frame) => (
        <li key={frame.report_id} className={`scan-frame scan-frame--${frame.result}`}>
          {onOpen ? (
            <button type="button" className="scan-frame__open" title={t('feedback.open')} onClick={() => onOpen(frame.report_id)}>
              <ScanFrameFace frame={frame} />
            </button>
          ) : (
            <ScanFrameFace frame={frame} />
          )}
        </li>
      ))}
    </ul>
  );
}
