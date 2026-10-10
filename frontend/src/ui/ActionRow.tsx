import { Icon, type IconName } from './Icon';
import './blocked.css';

export interface RowAction {
  readonly id: string;
  readonly icon: IconName;
  readonly label: string;
  readonly onClick: () => void;
  /** Shown but not usable now (aria-disabled); the tap still reaches onClick, which says why. */
  readonly blocked?: boolean;
  /** Off for a moment, e.g. while the action is on its way. */
  readonly disabled?: boolean;
}

interface ActionRowProps {
  readonly label: string;
  readonly actions: readonly RowAction[];
  /** The one action filled with the accent. */
  readonly primaryId: string;
  /** Visible line under the row, e.g. why an action is not open yet. */
  readonly note: string;
}

export function ActionRow({ label, actions, primaryId, note }: ActionRowProps) {
  return (
    <>
      <ul className="action-row" aria-label={label}>
        {actions.map((action) => (
          <li key={action.id}>
            <button
              type="button"
              className={action.id === primaryId ? 'action-row__button action-row__button--primary' : 'action-row__button'}
              onClick={action.onClick}
              disabled={action.disabled}
              aria-disabled={action.blocked || undefined}
            >
              <span className="action-row__icon">
                <Icon name={action.icon} size={20} />
              </span>
              {action.label}
            </button>
          </li>
        ))}
      </ul>
      <p className="action-row__note" aria-live="polite">
        {note}
      </p>
    </>
  );
}
