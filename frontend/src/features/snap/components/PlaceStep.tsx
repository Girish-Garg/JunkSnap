import { useTranslation } from 'react-i18next';
import { ChoiceChips, type ChoiceOption } from '../../../ui/ChoiceChips';
import type { TargetPlace } from '../hooks/useTargetPlacement';
import '../place.css';
import { TargetPanel } from './TargetPanel';

type Where = 'here' | 'far';

/** Right here (the default, no tap needed) or farther away, marked on a small map (decision 20261011-0400). */
export function PlaceStep({ place }: { readonly place: TargetPlace }) {
  const { t } = useTranslation();
  const options: readonly ChoiceOption<Where>[] = [
    { value: 'here', label: t('longRange.here') },
    { value: 'far', label: t('longRange.far') },
  ];
  return (
    <div className="field place-step">
      <p className="field__label">{t('longRange.label')}</p>
      <ChoiceChips label={t('longRange.label')} options={options} value={place.far ? 'far' : 'here'} onChange={(where) => place.chooseFar(where === 'far')} />
      {place.far ? <TargetPanel place={place} /> : <p className="field__hint">{t('longRange.hint')}</p>}
    </div>
  );
}
