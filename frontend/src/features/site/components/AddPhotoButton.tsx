import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../../ui/Icon';
import type { AddPhoto } from '../hooks/useAddPhoto';

interface AddPhotoButtonProps {
  readonly addPhoto: AddPhoto;
}

/** The pill beside a site's photo count; when it cannot work yet it stays visible, muted, with the reason under it. */
export function AddPhotoButton({ addPhoto }: AddPhotoButtonProps) {
  const { t } = useTranslation();
  const reasonId = useId();
  const { availability, blocked } = addPhoto;
  const reason = availability.enabled ? null : t(availability.reason, availability.params);
  return (
    <div className="add-photo">
      <button
        type="button"
        className="add-photo__button"
        aria-disabled={blocked || undefined}
        aria-describedby={reason ? reasonId : undefined}
        onClick={addPhoto.open}
      >
        <Icon name="camera" size={18} />
        {t('addPhoto.action')}
      </button>
      {reason && (
        <p id={reasonId} className="add-photo__reason">
          {reason}
        </p>
      )}
    </div>
  );
}
