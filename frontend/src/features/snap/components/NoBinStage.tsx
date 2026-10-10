import { useTranslation } from 'react-i18next';
import { lookOf } from '../../../domain/ActionAvailability';
import { CAPTURE_GATES } from '../../../domain/CaptureGates';
import { NoBinReporter } from '../../../services/NoBinReporter';
import { Button } from '../../../ui/Button';
import { useGate } from '../../actions/hooks/useGate';
import { useSessionFacts } from '../../actions/hooks/useSessionFacts';
import type { GpsState } from '../hooks/useGpsFix';
import { useNoBinReport } from '../hooks/useNoBinReport';
import '../nobin.css';

interface NoBinStageProps {
  readonly gps: GpsState;
  /** The optional photo goes through the normal Photo flow with the No bin type. */
  readonly onPhoto: () => void;
}

function locationKey(fix: GpsState['fix']): string {
  if (fix === null) return 'nobin.waiting';
  return NoBinReporter.accurateEnough(fix) ? 'nobin.accuracy' : 'nobin.tooVague';
}

/** "There is no dustbin within 1 km of here": one tap from where you stand, GPS 50 m or better, online and signed in. */
export function NoBinStage({ gps, onPhoto }: NoBinStageProps) {
  const { t } = useTranslation();
  const gate = useGate();
  const report = useNoBinReport();
  const { fix } = gps;
  const facts = { ...useSessionFacts(), fix, sent: report.state === 'sent', busy: report.state === 'sending' };
  const availability = CAPTURE_GATES.noBin.decide(facts);
  return (
    <section className="nobin-stage" aria-labelledby="nobin-title">
      <h3 id="nobin-title" className="nobin-stage__title">{t('nobin.title')}</h3>
      <p className="nobin-stage__text">{t('nobin.text')}</p>
      <p className="nobin-stage__location" role="status">{t(locationKey(fix), { metres: Math.round(fix?.accuracy_m ?? 0) })}</p>
      <Button onClick={gate(availability, () => fix && void report.send(fix))} {...lookOf(availability)}>
        {t(report.state === 'sending' ? 'nobin.sending' : 'nobin.send')}
      </Button>
      <Button variant="text" onClick={onPhoto}>
        {t('nobin.photo')}
      </Button>
      {report.state === 'sent' && <p role="status">{t('nobin.sent')}</p>}
      {report.problem && <p className="form__error" role="alert">{t(report.problem)}</p>}
    </section>
  );
}
