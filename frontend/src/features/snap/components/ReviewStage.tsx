import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NOTE_MAX_LENGTH } from '../../../domain/ReportUpload';
import { TextArea } from '../../../ui/TextArea';
import type { GpsState } from '../hooks/useGpsFix';
import type { CapturedPhoto } from '../hooks/usePhotoCapture';
import { usePhotoPreview } from '../hooks/usePhotoPreview';
import { useReportChoice } from '../hooks/useReportChoice';
import type { SnapFlow } from '../hooks/useSnapFlow';
import { ContextPicker } from './ContextPicker';
import { GpsPanel } from './GpsPanel';
import { SendActions } from './SendActions';
import { TypePicker } from './TypePicker';

interface ReviewStageProps {
  readonly photo: CapturedPhoto;
  readonly flow: SnapFlow;
  readonly gps: GpsState;
}

/** The reporter's own photo stays on this screen only; everything after shows the blurred copy. */
export function ReviewStage({ photo, flow, gps }: ReviewStageProps) {
  const { t } = useTranslation();
  const report = useReportChoice();
  const preview = usePhotoPreview(photo.bytes);
  const [sending, setSending] = useState(false);
  const send = () => {
    if (!report.choice || !gps.fix) return;
    setSending(true);
    void flow.send(photo, report.choice, gps.fix).finally(() => setSending(false));
  };
  const note = t('snap.noteHint', { left: report.noteLeft });
  return (
    <div className="snap-review">
      <div className="snap-review__top">
        <img ref={preview} className="snap-review__photo" alt={t('snap.photoAlt')} />
        <GpsPanel gps={gps} />
      </div>
      <TypePicker value={report.type} onChange={report.chooseType} />
      <ContextPicker options={report.contexts} value={report.context} onChange={report.setContext} />
      <TextArea id="snap-note" label={t('snap.note')} value={report.note} onChange={report.setNote} maxLength={NOTE_MAX_LENGTH} hint={note} />
      <SendActions canSend={Boolean(report.choice && gps.fix) && !sending} saveFailed={flow.saveFailed} onSend={send} onRetake={flow.restart} />
    </div>
  );
}
