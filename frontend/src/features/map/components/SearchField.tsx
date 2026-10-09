import { useTranslation } from 'react-i18next';
import { IconButton } from '../../../ui/IconButton';

interface SearchFieldProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
}

export function SearchField({ value, onChange }: SearchFieldProps) {
  const { t } = useTranslation();
  return (
    <>
      <input
        className="searchbar__input"
        type="search"
        enterKeyHint="search"
        aria-label={t('search.label')}
        placeholder={t('search.placeholder')}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && <IconButton icon="close" label={t('search.clear')} onClick={() => onChange('')} />}
    </>
  );
}
