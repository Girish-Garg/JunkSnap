import { useTranslation } from 'react-i18next';
import { Icon } from '../../../ui/Icon';
import { useViewToggle, type MapOrList } from '../hooks/useViewToggle';
import '../browse.css';

interface ViewToggleProps {
  /** The list is open, maybe under the preview card of one of its sites. */
  readonly listOpen: boolean;
  readonly onList: () => void;
}

const OPTIONS: readonly MapOrList[] = ['map', 'list'];

/** Map or list, beside Filters. */
export function ViewToggle({ listOpen, onList }: ViewToggleProps) {
  const { t } = useTranslation();
  const toggle = useViewToggle(listOpen, onList);
  return (
    <div className="segmented view-toggle" role="group" aria-label={t('browse.toggle')}>
      {OPTIONS.map((value) => (
        <button
          key={value}
          type="button"
          className="segmented__option"
          aria-label={t(`browse.${value}Label`)}
          aria-pressed={toggle.current === value}
          onClick={() => toggle.pick(value)}
        >
          <Icon name={value} size={18} />
          {t(`browse.${value}`)}
        </button>
      ))}
    </div>
  );
}
