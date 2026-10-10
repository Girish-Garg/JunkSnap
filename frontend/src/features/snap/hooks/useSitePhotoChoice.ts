import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NOTE_MAX_LENGTH, type GpsFix } from '../../../domain/ReportUpload';
import type { SitePhotoChoice, SitePhotoPreset } from '../../../domain/SitePhotoPreset';
import { useFormatter } from '../../../i18n/useFormatter';
import { NoBinReporter } from '../../../services/NoBinReporter';

// What Send says when it is off: a vague no-bin fix, or the limit a too-far photo missed.
function blockers(reach: ReturnType<SitePhotoPreset['reach']>, vague: boolean, gps: GpsFix) {
  return { vagueM: vague ? gps.accuracy_m : null, tooFarLimitM: reach.kind === 'tooFar' ? reach.limit : null };
}

/**
 * The review of a photo for a site: type and context come from the site, the note is the reporter's, and the photo's
 * own fix decides whether it is at the site, marked on it from afar (300 m, or farther when up high, decision
 * 20261011-0400), or too far to join it. A no-bin zone also needs the fix at 50 m or better (decision 20261010-1630).
 */
export function useSitePhotoChoice(preset: SitePhotoPreset, gps: GpsFix) {
  const { t } = useTranslation();
  const format = useFormatter();
  const [note, setNote] = useState('');
  const [high, setHigh] = useState(false);
  const reach = preset.reach(gps, high);
  const distance = format.distance(reach.metres);
  const vague = preset.reportType === 'no_bin' && !NoBinReporter.accurateEnough(gps);
  const choice: SitePhotoChoice | null = vague ? null : preset.choice(gps, note, high);
  const tooFar = reach.kind === 'tooFar' ? t('addPhoto.tooFarPhoto', { distance, limit: reach.limit }) : null;
  const where = reach.kind === 'longRange' ? t('addPhoto.longRange', { distance }) : t('addPhoto.here');
  return {
    note,
    setNote: (value: string) => setNote(value.slice(0, NOTE_MAX_LENGTH)),
    noteLeft: NOTE_MAX_LENGTH - note.length,
    high,
    setHigh,
    /** Up high only matters for a photo taken away from the site, and never for a no-bin zone. */
    offerHigh: preset.takesTarget && preset.reach(gps).kind !== 'here',
    choice,
    ...blockers(reach, vague, gps),
    notice: vague ? t('nobin.photoTooVague', { metres: Math.round(gps.accuracy_m) }) : tooFar,
    where: reach.kind === 'tooFar' ? null : where,
  };
}
