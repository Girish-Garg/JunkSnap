import { Illustration, type IllustrationName } from './Illustration';

interface EmptyStateProps {
  readonly art: IllustrationName;
  readonly title: string;
  readonly text?: string;
}

export function EmptyState({ art, title, text }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <Illustration name={art} />
      <p className="empty-state__title">{title}</p>
      {text && <p>{text}</p>}
    </div>
  );
}
