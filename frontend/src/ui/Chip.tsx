import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface ChipProps {
  readonly label: string;
  readonly pressed: boolean;
  readonly onToggle: () => void;
  readonly leading?: ReactNode;
}

export function Chip({ label, pressed, onToggle, leading }: ChipProps) {
  return (
    <button type="button" className="chip" aria-pressed={pressed} onClick={onToggle}>
      {pressed && <Icon name="check" size={18} />}
      {leading}
      <span>{label}</span>
    </button>
  );
}
