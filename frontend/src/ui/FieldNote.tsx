interface FieldNoteProps {
  readonly id: string;
  readonly error?: string | null;
  readonly hint?: string | null;
}

/** The line under a field: the error if there is one, else the hint. */
export function FieldNote({ id, error, hint }: FieldNoteProps) {
  const text = error ?? hint;
  if (!text) return null;
  return (
    <p id={id} className={error ? 'field__error' : 'field__hint'}>
      {text}
    </p>
  );
}
