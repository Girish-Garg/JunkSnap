import { Icon, type IconName } from './Icon';

interface NoticeProps {
  readonly icon: IconName;
  readonly text: string;
  readonly tone?: 'info' | 'warn' | 'alert';
  /** A spinner in place of the icon, for something still on its way. */
  readonly busy?: boolean;
}

export function Notice({ icon, text, tone = 'info', busy = false }: NoticeProps) {
  return (
    <p className={`notice notice--${tone}`} role={tone === 'alert' ? 'alert' : 'status'}>
      {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name={icon} size={20} />}
      <span className="notice__text">{text}</span>
    </p>
  );
}
