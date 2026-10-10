import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../../ui/Icon';
import { PhoneDialog, type PhoneTask } from './PhoneDialog';

/** Desktop only: Scan and Report at the map's top right; both open the "use your phone" dialog. */
export function DesktopActions() {
  const { t } = useTranslation();
  const [task, setTask] = useState<PhoneTask | null>(null);
  return (
    <div className="desktop-actions">
      <button type="button" className="button button--secondary" aria-haspopup="dialog" onClick={() => setTask('scan')}>
        <Icon name="video" size={20} />
        {t('desktop.scan')}
      </button>
      <button type="button" className="button button--sun" aria-haspopup="dialog" onClick={() => setTask('report')}>
        <Icon name="camera" size={20} />
        {t('desktop.report')}
      </button>
      {task && <PhoneDialog task={task} onClose={() => setTask(null)} />}
    </div>
  );
}
