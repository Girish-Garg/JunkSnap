import { useTranslation } from 'react-i18next';
import { Icon } from '../../../ui/Icon';

interface PhoneCameraButtonProps {
  readonly onFile: (file: Blob) => void;
  /** Filled when the in-app viewfinder is not available. */
  readonly primary: boolean;
}

/** The phone's own camera app; capture="environment" opens the camera, not the gallery. */
export function PhoneCameraButton({ onFile, primary }: PhoneCameraButtonProps) {
  const { t } = useTranslation();
  return (
    <label className={`button button--${primary ? 'primary' : 'text'} phone-camera`}>
      <Icon name="camera" size={20} />
      {t('snap.phoneCamera')}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="visually-hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onFile(file);
        }}
      />
    </label>
  );
}
