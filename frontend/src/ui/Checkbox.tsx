import { FieldNote } from './FieldNote';

interface CheckboxProps {
  readonly id: string;
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly error?: string | null;
}

export function Checkbox({ id, label, checked, onChange, error }: CheckboxProps) {
  return (
    <div className="field">
      <label className="checkbox" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-note` : undefined}
          onChange={(event) => onChange(event.target.checked)}
        />
        {label}
      </label>
      <FieldNote id={`${id}-note`} error={error} />
    </div>
  );
}
