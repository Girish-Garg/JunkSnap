import { useTranslation } from 'react-i18next';
import { AUTO_STOP_MS } from '../../../services/RecordingSession';
import type { RecorderPhase } from '../hooks/useScanRecorder';

interface RecordControlsProps {
  readonly phase: RecorderPhase;
  readonly elapsedMs: number;
  readonly canStart: boolean;
  readonly onStart: () => void;
  readonly onStop: () => void;
}

const clock = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** A red record button; while recording, the timer against the 1-minute cap and a stop button. */
export function RecordControls({ phase, elapsedMs, canStart, onStart, onStop }: RecordControlsProps) {
  const { t } = useTranslation();
  if (phase === 'idle') {
    return (
      <div className="snap-camera__controls">
        <button type="button" className="record-button" aria-label={t('scan.record')} disabled={!canStart} onClick={onStart} />
      </div>
    );
  }
  return (
    <div className="snap-camera__controls">
      <p className="record-timer" role="timer" aria-live="off">
        <span className="record-timer__dot" aria-hidden="true" />
        {t('scan.timer', { elapsed: clock(elapsedMs), limit: clock(AUTO_STOP_MS) })}
      </p>
      <button type="button" className="stop-button" aria-label={t('scan.stop')} disabled={phase === 'saving'} onClick={onStop} />
      {phase === 'saving' && <p className="form__note">{t('scan.saving')}</p>}
    </div>
  );
}
