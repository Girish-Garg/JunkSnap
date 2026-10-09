import type { ReactNode } from 'react';

interface SwitchRowProps {
  readonly label: string;
  readonly checked: boolean;
  readonly onToggle: () => void;
  readonly leading?: ReactNode;
  readonly meta?: string;
}

export function SwitchRow({ label, checked, onToggle, leading, meta }: SwitchRowProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch-row" onClick={onToggle}>
      {leading}
      <span className="switch-row__label">{label}</span>
      {meta && <span className="switch-row__meta">{meta}</span>}
      <span className="switch-row__track" aria-hidden="true" />
    </button>
  );
}
