import { useTranslation } from 'react-i18next';
import { Button } from '../../../ui/Button';
import { IconButton } from '../../../ui/IconButton';
import { useActivityDelete, type ActivityTarget } from '../hooks/useActivityDelete';
import '../activity.css';

/** Delete on every Activity card: a small trash button at the end of the actions, then a confirm step that says what happens to the site. */
export function ActivityDelete({ target }: { readonly target: ActivityTarget }) {
  const { t } = useTranslation();
  const remove = useActivityDelete(target);
  return (
    <>
      {remove.plan === null ? (
        <span className="activity-delete__trigger">
          <IconButton icon="trash" label={t('activityDelete.action')} onClick={remove.ask} disabled={remove.busy} />
        </span>
      ) : (
        <div className="activity-delete" role="group" aria-label={t('activityDelete.action')}>
          <p className="activity-delete__text">{t(`activityDelete.confirm_${remove.plan}`)}</p>
          <Button variant="secondary" size="small" onClick={remove.confirm} disabled={remove.busy}>
            {t(remove.busy ? 'activityDelete.busy' : 'activityDelete.yes')}
          </Button>
          <Button variant="text" size="small" onClick={remove.cancel} disabled={remove.busy}>
            {t('activityDelete.keep')}
          </Button>
        </div>
      )}
      {remove.problem && (
        <p className="form__error activity-delete__error" role="alert">
          {t(`activityDelete.errors.${remove.problem}`)}
        </p>
      )}
    </>
  );
}
