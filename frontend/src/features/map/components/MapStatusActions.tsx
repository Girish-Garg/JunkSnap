import { useTranslation } from 'react-i18next';
import type { StatusActions } from '../hooks/useStatusActions';
import type { NoticeAction } from '../MapNotice';

interface MapStatusActionsProps {
  readonly action: NoticeAction;
  readonly actions: StatusActions;
}

/** The toast's buttons: beside its line, or below it when they do not fit. */
export function MapStatusActions({ action, actions }: MapStatusActionsProps) {
  const { t } = useTranslation();
  const { nearest, retryMap, mapless } = actions;
  if (action === 'nearest' && nearest) return <StatusButton label={t('notice.showNearest')} onClick={nearest} />;
  if (action === 'retryMap' && retryMap) return <StatusButton label={t('notice.mapRetry')} onClick={retryMap} />;
  if (action !== 'mapless' || !mapless) return null;
  return (
    <>
      <StatusButton label={t('browse.list')} onClick={mapless.list} quiet />
      <StatusButton label={t('nav.areas')} onClick={mapless.areas} quiet />
      <StatusButton label={t('nav.report')} onClick={mapless.report} quiet />
    </>
  );
}

interface StatusButtonProps {
  readonly label: string;
  readonly onClick: () => void;
  /** One of several: the surface pill, so three buttons never shout. */
  readonly quiet?: boolean;
}

function StatusButton({ label, onClick, quiet = false }: StatusButtonProps) {
  return (
    <button type="button" className={quiet ? 'pill' : 'pill map-status__action'} onClick={onClick}>
      {label}
    </button>
  );
}
