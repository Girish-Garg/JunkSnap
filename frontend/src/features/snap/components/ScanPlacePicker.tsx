import { useTranslation } from 'react-i18next';
import { AUTO, type ScanPlace } from '../../../domain/ScanUpload';
import { ChoiceChips } from '../../../ui/ChoiceChips';
import { FieldNote } from '../../../ui/FieldNote';

interface ScanPlacePickerProps {
  readonly options: readonly ScanPlace[];
  readonly value: ScanPlace | null;
  readonly onChange: (place: ScanPlace) => void;
}

const NOTE_ID = 'scan-place-note';

/** "Where is it?" for a video: Auto lets the models name the place in each frame. */
export function ScanPlacePicker({ options, value, onChange }: ScanPlacePickerProps) {
  const { t } = useTranslation();
  const choices = options.map((place) => ({ value: place, label: t(place === AUTO ? 'scan.placeAuto' : `context.${place}`) }));
  const hint = value === null ? t('snap.contextHint') : value === AUTO ? t('scan.placeAutoHint') : null;
  return (
    <div className="field">
      <p className="field__label">{t('snap.context')}</p>
      <ChoiceChips<ScanPlace> label={t('snap.context')} options={choices} value={value} onChange={onChange} hintId={hint ? NOTE_ID : undefined} />
      <FieldNote id={NOTE_ID} hint={hint} />
    </div>
  );
}
