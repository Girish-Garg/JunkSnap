import { Icon, type IconName } from './Icon';

interface IconButtonProps {
  readonly icon: IconName;
  readonly label: string;
  readonly onClick: () => void;
  readonly variant?: 'float' | 'plain';
  readonly expanded?: boolean;
  readonly disabled?: boolean;
}

export function IconButton({ icon, label, onClick, variant = 'plain', expanded, disabled }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-button icon-button--${variant}`}
      aria-label={label}
      aria-expanded={expanded}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} size={22} />
    </button>
  );
}
