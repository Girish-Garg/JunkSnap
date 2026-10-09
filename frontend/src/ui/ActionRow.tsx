import { Icon, type IconName } from './Icon';

export interface RowAction {
  readonly id: string;
  readonly icon: IconName;
  readonly label: string;
  /** Missing means not built yet: shown disabled with `note`. */
  readonly onClick?: () => void;
  readonly note?: string;
}

interface ActionRowProps {
  readonly label: string;
  readonly actions: readonly RowAction[];
}

export function ActionRow({ label, actions }: ActionRowProps) {
  return (
    <ul className="action-row" aria-label={label}>
      {actions.map((action) => (
        <li key={action.id}>
          <button
            type="button"
            className="action-row__button"
            disabled={!action.onClick}
            title={action.note}
            onClick={action.onClick}
          >
            <span className="action-row__icon">
              <Icon name={action.icon} />
            </span>
            {action.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
