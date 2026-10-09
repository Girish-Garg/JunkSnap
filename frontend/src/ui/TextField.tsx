import type { HTMLAttributes, ReactNode } from 'react';
import { FieldNote } from './FieldNote';

export interface TextFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly type?: 'text' | 'email' | 'password';
  readonly autoComplete?: string;
  readonly inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  readonly maxLength?: number;
  readonly error?: string | null;
  readonly hint?: string | null;
  readonly variant?: 'code' | 'with-button';
  readonly trailing?: ReactNode;
}

/** 48 px field; the error (or hint) sits under it and is linked with aria-describedby. */
export function TextField(props: TextFieldProps) {
  const { id, label, value, onChange, error, hint, variant } = props;
  const noteId = error || hint ? `${id}-note` : undefined;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="field__control">
        <input
          id={id}
          className={variant ? `field__input field__input--${variant}` : 'field__input'}
          type={props.type ?? 'text'}
          autoComplete={props.autoComplete}
          inputMode={props.inputMode}
          maxLength={props.maxLength}
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={noteId}
          onChange={(event) => onChange(event.target.value)}
        />
        {props.trailing}
      </div>
      <FieldNote id={`${id}-note`} error={error} hint={hint} />
    </div>
  );
}
