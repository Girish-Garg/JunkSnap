import { FieldNote } from './FieldNote';

interface TextAreaProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly maxLength: number;
  readonly hint?: string | null;
}

export function TextArea({ id, label, value, onChange, maxLength, hint }: TextAreaProps) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className="field__input field__input--area"
        rows={2}
        maxLength={maxLength}
        value={value}
        aria-describedby={hint ? `${id}-note` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldNote id={`${id}-note`} hint={hint} />
    </div>
  );
}
