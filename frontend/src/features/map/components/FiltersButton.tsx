import { useTranslation } from 'react-i18next';
import { Icon } from '../../../ui/Icon';

interface FiltersButtonProps {
  readonly activeCount: number;
  readonly onOpen: () => void;
}

export function FiltersButton({ activeCount, onOpen }: FiltersButtonProps) {
  const { t } = useTranslation();
  const label = activeCount > 0 ? t('filters.buttonActive', { count: activeCount }) : t('filters.button');
  return (
    <button type="button" className="pill" aria-haspopup="dialog" aria-pressed={activeCount > 0} onClick={onOpen}>
      <Icon name="filter" size={18} />
      {label}
    </button>
  );
}
