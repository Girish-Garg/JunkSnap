import type { ReactNode } from 'react';

interface ButtonProps {
  readonly children: ReactNode;
  readonly variant?: 'primary' | 'text';
  readonly type?: 'button' | 'submit';
  readonly onClick?: () => void;
  readonly disabled?: boolean;
}

export function Button({ children, variant = 'primary', type = 'button', onClick, disabled }: ButtonProps) {
  return (
    <button type={type} className={`button button--${variant}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
