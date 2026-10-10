import { Icon, type IconName } from './Icon';

export interface RowAction {
  readonly id: string;
  readonly icon: IconName;
  readonly label: string;
  readonly onClick: () => void;
  /** Shown but not usable yet; the note says why. */
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
