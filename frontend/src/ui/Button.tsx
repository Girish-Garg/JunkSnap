import type { ReactNode } from 'react';
import './blocked.css';

interface ButtonProps {
  readonly children: ReactNode;
  readonly variant?: 'primary' | 'secondary' | 'sun' | 'tonal' | 'text';
  /** small: a compact 44 px row action, for cards. */
  readonly size?: 'regular' | 'small';
  readonly type?: 'button' | 'submit';
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  /** Looks off (aria-disabled) but still takes the tap, so the action can say why it is off. */
  readonly blocked?: boolean;
}

export function Button({ children, variant = 'primary', size = 'regular', type = 'button', onClick, disabled, blocked = false }: ButtonProps) {
  return (
    <button type={type} className={`button button--${variant} button--${size}`} onClick={onClick} disabled={disabled} aria-disabled={blocked || undefined}>
      {children}
    </button>
  );
}
