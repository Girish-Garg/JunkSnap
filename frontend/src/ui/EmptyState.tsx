import type { ReactNode } from 'react';
import { Illustration, type IllustrationName } from './Illustration';

interface EmptyStateProps {
  readonly art: IllustrationName;
  readonly title: string;
  readonly text?: string;
  /** One next step, such as a button. */
  readonly action?: ReactNode;
}

export function EmptyState({ art, title, text, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <Illustration name={art} />
      <p className="empty-state__title">{title}</p>
      {text && <p>{text}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
