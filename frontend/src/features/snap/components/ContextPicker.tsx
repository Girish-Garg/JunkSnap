import { useTranslation } from 'react-i18next';
import type { SiteContext } from '../../../domain/Site';
import { ChoiceChips } from '../../../ui/ChoiceChips';
import { FieldNote } from '../../../ui/FieldNote';

interface ContextPickerProps {
  readonly options: readonly SiteContext[];
  readonly value: SiteContext | null;
  readonly onChange: (context: SiteContext) => void;
}

const HINT_ID = 'snap-context-note';

export function ContextPicker({ options, value, onChange }: ContextPickerProps) {
  const { t } = useTranslation();
  const choices = options.map((context) => ({ value: context, label: t(`context.${context}`) }));
  return (
    <div className="field">
      <p className="field__label">{t('snap.context')}</p>
      <ChoiceChips label={t('snap.context')} options={choices} value={value} onChange={onChange} hintId={value ? undefined : HINT_ID} />
      <FieldNote id={HINT_ID} hint={value ? null : t('snap.contextHint')} />
    </div>
  );
}
