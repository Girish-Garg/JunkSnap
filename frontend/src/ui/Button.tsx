import type { ReactNode } from 'react';

interface ButtonProps {
  readonly children: ReactNode;
  readonly variant?: 'primary' | 'secondary' | 'sun' | 'tonal' | 'text';
  /** small: a compact 44 px row action, for cards. */
  readonly size?: 'regular' | 'small';
  readonly type?: 'button' | 'submit';
  readonly onClick?: () => void;
  readonly disabled?: boolean;
}

export function Button({ children, variant = 'primary', size = 'regular', type = 'button', onClick, disabled }: ButtonProps) {
  return (
    <button type={type} className={`button button--${variant} button--${size}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
