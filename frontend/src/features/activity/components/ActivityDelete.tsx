import { useTranslation } from 'react-i18next';
import { Button } from '../../../ui/Button';
import { useActivityDelete, type ActivityTarget } from '../hooks/useActivityDelete';
import '../activity.css';

/** Delete on every Activity row, with a confirm step that says what happens to the site. */
export function ActivityDelete({ target }: { readonly target: ActivityTarget }) {
  const { t } = useTranslation();
  const remove = useActivityDelete(target);
  return (
    <>
      {remove.plan === null ? (
        <Button variant="text" onClick={remove.ask} disabled={remove.busy}>
          {t('activityDelete.action')}
        </Button>
      ) : (
        <div className="activity-delete" role="group" aria-label={t('activityDelete.action')}>
          <p className="activity-delete__text">{t(`activityDelete.confirm_${remove.plan}`)}</p>
          <Button variant="secondary" onClick={remove.confirm} disabled={remove.busy}>
            {t(remove.busy ? 'activityDelete.busy' : 'activityDelete.yes')}
          </Button>
          <Button variant="text" onClick={remove.cancel} disabled={remove.busy}>
            {t('activityDelete.keep')}
          </Button>
        </div>
      )}
      {remove.problem && (
        <p className="form__error" role="alert">
          {t(`activityDelete.errors.${remove.problem}`)}
        </p>
      )}
    </>
  );
}
