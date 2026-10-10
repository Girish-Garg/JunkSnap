import { useTranslation } from 'react-i18next';
import { HistoryLayers } from '../../../ui/HistoryLayers';
import { Icon } from '../../../ui/Icon';
import '../browse.css';

type View = 'map' | 'list';

interface ViewToggleProps {
  /** The list is open, maybe under the preview card of one of its sites. */
  readonly listOpen: boolean;
  readonly onList: () => void;
}

const OPTIONS: readonly { readonly value: View; readonly icon: 'map' | 'list' }[] = [
  { value: 'map', icon: 'map' },
  { value: 'list', icon: 'list' },
];

/**
 * Map or list, beside Filters. List opens the list sheet (closing a pin's preview card or stack list first);
 * with the list open under a site's card, List goes back to it and Map leaves both, through history as back does.
 */
export function ViewToggle({ listOpen, onList }: ViewToggleProps) {
  const { t } = useTranslation();
  const pick = (view: View) => {
    if (view === 'map') {
      if (listOpen) HistoryLayers.unwind(() => undefined);
    } else if (listOpen) {
      // The list is open under a site's card: back to it.
      HistoryLayers.back();
    } else {
      HistoryLayers.unwind(onList);
    }
  };
  return (
    <div className="segmented view-toggle" role="group" aria-label={t('browse.toggle')}>
      {OPTIONS.map(({ value, icon }) => (
        <button
          key={value}
          type="button"
          className="segmented__option"
          aria-label={t(`browse.${value}Label`)}
          aria-pressed={listOpen === (value === 'list')}
          onClick={() => pick(value)}
        >
          <Icon name={icon} size={18} />
          {t(`browse.${value}`)}
        </button>
      ))}
    </div>
  );
}
