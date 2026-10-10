interface AuthHeadingProps {
  readonly id: string;
  readonly title: string;
  readonly text: string;
}

export function AuthHeading({ id, title, text }: AuthHeadingProps) {
  return (
    <header>
      <h2 id={id} className="sheet-title" tabIndex={-1}>
        {title}
      </h2>
      <p className="sheet-text">{text}</p>
    </header>
  );
}
