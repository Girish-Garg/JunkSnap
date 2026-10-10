import { useTranslation } from 'react-i18next';
import { REPORT_TYPES, type ReportType } from '../../../domain/ReportType';
import { ChoiceChips } from '../../../ui/ChoiceChips';
import { TypeIcon } from '../../../ui/TypeIcon';

interface TypePickerProps {
  readonly value: ReportType;
  readonly onChange: (type: ReportType) => void;
}

export function TypePicker({ value, onChange }: TypePickerProps) {
  const { t } = useTranslation();
  const options = REPORT_TYPES.map((type) => ({
    value: type,
    label: t(`reportType.${type}`),
    leading: <TypeIcon type={type} size={20} />,
  }));
  return (
    <div className="field">
      <p className="field__label">{t('snap.type')}</p>
      <ChoiceChips label={t('snap.type')} options={options} value={value} onChange={onChange} />
    </div>
  );
}
