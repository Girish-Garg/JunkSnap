import { useTranslation } from 'react-i18next';
import { lookOf, type Availability } from '../../../domain/ActionAvailability';
import { AUTO_STOP_MS } from '../../../services/RecordingSession';
import '../../../ui/blocked.css';
import { useGate } from '../../actions/hooks/useGate';
import type { RecorderPhase } from '../hooks/useScanRecorder';

interface RecordControlsProps {
  readonly phase: RecorderPhase;
  readonly elapsedMs: number;
  /** Whether recording can start now; when not, a tap on the record button says why. */
  readonly start: Availability;
  readonly onStart: () => void;
  readonly onStop: () => void;
}

const clock = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** A red record button; while recording, the timer against the 1-minute cap and a stop button. */
export function RecordControls({ phase, elapsedMs, start, onStart, onStop }: RecordControlsProps) {
  const { t } = useTranslation();
  const gate = useGate();
  if (phase === 'idle') {
    const look = lookOf(start);
    return (
      <div className="snap-camera__controls">
        <button type="button" className="record-button" aria-label={t('scan.record')} disabled={look.disabled} aria-disabled={look.blocked || undefined} onClick={gate(start, onStart)} />
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
