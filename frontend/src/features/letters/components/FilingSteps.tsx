import { useTranslation } from 'react-i18next';
import type { LetterScope } from '../hooks/useLetterRequest';

interface FilingStepsProps {
  readonly scope: LetterScope;
  /** The letter has offices in Cc (a district letter has none). */
  readonly copies: boolean;
}

/** How a resident files the letter: send it, keep the acknowledgement, note the reference on the site. Screen only. */
export function FilingSteps({ scope, copies }: FilingStepsProps) {
  const { t } = useTranslation();
  const note = scope === 'area' ? 'letter.file.noteArea' : 'letter.file.note';
  const steps = ['letter.file.send', ...(copies ? ['letter.file.cc'] : []), 'letter.file.keep', note];
  return (
    <details className="filing-steps">
      <summary>{t('letter.file.title')}</summary>
      <ol>
        {steps.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ol>
    </details>
  );
}
