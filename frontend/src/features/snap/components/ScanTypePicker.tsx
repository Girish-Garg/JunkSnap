import { useTranslation } from 'react-i18next';
import { REPORT_TYPES } from '../../../domain/ReportType';
import { AUTO, type ScanType } from '../../../domain/ScanUpload';
import { ChoiceChips } from '../../../ui/ChoiceChips';
import { FieldNote } from '../../../ui/FieldNote';
import { ScoutIcon } from '../../../ui/icons/ScoutIcon';
import { TypeIcon } from '../../../ui/TypeIcon';

interface ScanTypePickerProps {
  readonly value: ScanType;
  readonly onChange: (type: ScanType) => void;
}

const NOTE_ID = 'scan-type-note';

/** Area scout first: the app finds each kind of waste in the frames by itself; a picked type narrows it. */
export function ScanTypePicker({ value, onChange }: ScanTypePickerProps) {
  const { t } = useTranslation();
  const scout = {
    value: AUTO,
    label: t('scan.scout'),
    leading: (
      <span className="type-icon type-icon--auto">
        <ScoutIcon size={20} />
      </span>
    ),
  } as const;
  const picked = REPORT_TYPES.map((type) => ({ value: type, label: t(`reportType.${type}`), leading: <TypeIcon type={type} size={20} /> }));
  return (
    <div className="field">
      <p className="field__label">{t('snap.type')}</p>
      <ChoiceChips<ScanType> label={t('snap.type')} options={[scout, ...picked]} value={value} onChange={onChange} hintId={NOTE_ID} />
      <FieldNote id={NOTE_ID} hint={t(value === AUTO ? 'scan.scoutHint' : 'scan.pickedHint')} />
    </div>
  );
}
