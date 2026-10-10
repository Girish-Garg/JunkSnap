import { useFormatter } from '../../../i18n/useFormatter';
import { useNow } from '../hooks/useNow';

interface ActivityMetaProps {
  readonly place: string;
  readonly at: string;
}

/** "Roadside · 2 min ago"; the full date and time sit on the time's title (hover, long-press). */
export function ActivityMeta({ place, at }: ActivityMetaProps) {
  const format = useFormatter();
  const now = useNow();
  const full = format.dateTime(at);
  return (
    <p className="activity-card__meta">
      {place} ·{' '}
      <time dateTime={at} title={full}>
        {format.ago(at, now)}
      </time>
    </p>
  );
}
