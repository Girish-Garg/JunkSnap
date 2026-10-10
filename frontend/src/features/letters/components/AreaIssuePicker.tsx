import { useTranslation } from 'react-i18next';
import { AREA_ISSUES, type AreaIssue } from '../../../domain/AreaLetter';
import { ChoiceChips } from '../../../ui/ChoiceChips';

interface AreaIssuePickerProps {
  readonly value: AreaIssue;
  readonly onChange: (issue: AreaIssue) => void;
}

/** What the area letter is about: one report type, or all of them. */
export function AreaIssuePicker({ value, onChange }: AreaIssuePickerProps) {
  const { t } = useTranslation();
  const options = AREA_ISSUES.map((issue) => ({ value: issue, label: t(`areaLetter.issues.${issue}`) }));
  return (
    <div className="field">
      <p className="field__label">{t('areaLetter.issue')}</p>
      <ChoiceChips label={t('areaLetter.issue')} options={options} value={value} onChange={onChange} />
    </div>
  );
}
