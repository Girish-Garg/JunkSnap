import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NOTE_MAX_LENGTH } from '../../../domain/ReportUpload';
import type { SitePhotoPreset } from '../../../domain/SitePhotoPreset';
import { TextArea } from '../../../ui/TextArea';
import type { CapturedPhoto } from '../hooks/usePhotoCapture';
import { usePhotoPreview } from '../hooks/usePhotoPreview';
import { useSitePhotoChoice } from '../hooks/useSitePhotoChoice';
import type { SnapFlow } from '../hooks/useSnapFlow';
import { GpsPanel } from './GpsPanel';
import { SendActions } from './SendActions';

interface SitePhotoReviewProps {
  readonly photo: CapturedPhoto;
  readonly flow: SnapFlow;
  readonly preset: SitePhotoPreset;
}

/** Review for "Add a photo": no type or place to pick, since they are the site's; only a note, then Send. */
export function SitePhotoReview({ photo, flow, preset }: SitePhotoReviewProps) {
  const { t } = useTranslation();
  const report = useSitePhotoChoice(preset, photo.gps);
  const preview = usePhotoPreview(photo.bytes);
  const [sending, setSending] = useState(false);
  const send = () => {
    if (!report.choice) return;
    setSending(true);
    void flow.send(photo, report.choice).finally(() => setSending(false));
  };
  return (
    <div className="snap-review">
      <div className="snap-review__top">
        <img ref={preview} className="snap-review__photo" alt={t('snap.photoAlt')} />
        <GpsPanel gps={{ fix: photo.gps, problem: null }} />
      </div>
      <p className="snap-preset" role="status">
        {t('addPhoto.preset', { type: t(`reportType.${preset.reportType}`) })}
        {report.where && ` ${report.where}`}
      </p>
      <TextArea id="snap-note" label={t('snap.note')} value={report.note} onChange={report.setNote} maxLength={NOTE_MAX_LENGTH} hint={t('snap.noteHint', { left: report.noteLeft })} />
      <SendActions canSend={report.choice !== null && !sending} saveFailed={flow.saveFailed} notice={report.notice} onSend={send} onRetake={flow.retake} />
    </div>
  );
}
