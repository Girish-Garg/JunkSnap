import { useTranslation } from 'react-i18next';
import { lookOf } from '../../../domain/ActionAvailability';
import type { AreaIssueTally } from '../../../domain/AreaIssueTally';
import type { AreaIssue } from '../../../domain/AreaLetter';
import { ChoiceChips } from '../../../ui/ChoiceChips';
import { useAreaIssues } from '../hooks/useAreaIssues';

interface AreaIssuePickerProps {
  /** The area's verified reports per issue; null while they load. */
  readonly tally: AreaIssueTally | null;
  readonly value: AreaIssue;
  readonly onChange: (issue: AreaIssue) => void;
}

/** What the area letter is about: one report type, or all of them, each with its verified count; too few says why on a tap. */
export function AreaIssuePicker({ tally, value, onChange }: AreaIssuePickerProps) {
  const { t } = useTranslation();
  const choices = useAreaIssues(tally);
  const options = choices.map(({ issue, count, gated }) => ({
    value: issue,
    label: t(`areaLetter.issues.${issue}`),
    // The space keeps the chip's name "No bin 3" for screen readers; on screen the chip's gap spaces it.
    trailing: count && (
      <>
        {' '}
        <span className="chip__count">{count}</span>
      </>
    ),
    blocked: lookOf(gated.availability).blocked,
  }));
  const choose = (issue: AreaIssue) => choices.find((choice) => choice.issue === issue)?.gated.tap(() => onChange(issue))();
  return (
    <div className="field">
      <p className="field__label">{t('areaLetter.issue')}</p>
      <ChoiceChips label={t('areaLetter.issue')} options={options} value={value} onChange={choose} />
    </div>
  );
}
