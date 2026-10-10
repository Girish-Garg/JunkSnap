import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NOTE_MAX_LENGTH, type GpsFix } from '../../../domain/ReportUpload';
import type { SitePhotoChoice, SitePhotoPreset } from '../../../domain/SitePhotoPreset';
import { useFormatter } from '../../../i18n/useFormatter';
import { NoBinReporter } from '../../../services/NoBinReporter';

/**
 * The review of a photo for a site: type and context come from the site, the note is the reporter's, and the photo's
 * own fix decides whether it is at the site, marked on it from afar, or too far to join it. A no-bin zone also needs
 * the fix at 50 m or better, as any no-bin report does (decision 20261010-1630).
 */
export function useSitePhotoChoice(preset: SitePhotoPreset, gps: GpsFix) {
  const { t } = useTranslation();
  const format = useFormatter();
  const [note, setNote] = useState('');
  const reach = preset.reach(gps);
  const distance = format.distance(reach.metres);
  const vague = preset.reportType === 'no_bin' && !NoBinReporter.accurateEnough(gps);
  const choice: SitePhotoChoice | null = vague ? null : preset.choice(gps, note);
  const tooFar = reach.kind === 'tooFar' ? t('addPhoto.tooFarPhoto', { distance, limit: preset.limitM }) : null;
  const notice = vague ? t('nobin.photoTooVague', { metres: Math.round(gps.accuracy_m) }) : tooFar;
  const where = reach.kind === 'longRange' ? t('addPhoto.longRange', { distance }) : t('addPhoto.here');
  return {
    note,
    setNote: (value: string) => setNote(value.slice(0, NOTE_MAX_LENGTH)),
    noteLeft: NOTE_MAX_LENGTH - note.length,
    choice,
    notice,
    where: reach.kind === 'tooFar' ? null : where,
  };
}
