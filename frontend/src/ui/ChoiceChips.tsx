import type { ReactNode } from 'react';

export interface ChoiceOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly leading?: ReactNode;
}

interface ChoiceChipsProps<T extends string> {
  readonly label: string;
  readonly options: readonly ChoiceOption<T>[];
  readonly value: T | null;
  readonly onChange: (value: T) => void;
  readonly hintId?: string;
}

/** Single choice as 48 px chips; the selected one takes the accent tint. */
export function ChoiceChips<T extends string>({ label, options, value, onChange, hintId }: ChoiceChipsProps<T>) {
  return (
    <div className="chips" role="radiogroup" aria-label={label} aria-describedby={hintId}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className="chip"
          onClick={() => onChange(option.value)}
        >
          {option.leading}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
