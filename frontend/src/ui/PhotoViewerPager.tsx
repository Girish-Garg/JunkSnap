import { useTranslation } from 'react-i18next';
import { IconButton } from './IconButton';

interface PhotoViewerPagerProps {
  readonly index: number;
  readonly total: number;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}

/** Previous and next buttons for mouse and keyboard users; touch users swipe. */
export function PhotoViewerPager({ index, total, onPrevious, onNext }: PhotoViewerPagerProps) {
  const { t } = useTranslation();
  if (total < 2) return null;
  return (
    <div className="photo-viewer__pager">
      {index > 0 && <IconButton icon="previous" label={t('viewer.previous')} onClick={onPrevious} />}
      <span />
      {index < total - 1 && <IconButton icon="next" label={t('viewer.next')} onClick={onNext} />}
    </div>
  );
}
