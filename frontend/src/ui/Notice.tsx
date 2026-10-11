import { Icon, type IconName } from './Icon';

interface NoticeProps {
  readonly icon: IconName;
  readonly text: string;
  readonly tone?: 'info' | 'warn' | 'alert';
}

export function Notice({ icon, text, tone = 'info' }: NoticeProps) {
  return (
    <p className={`notice notice--${tone}`} role={tone === 'alert' ? 'alert' : 'status'}>
      <Icon name={icon} size={20} />
      <span>{text}</span>
    </p>
  );
}
