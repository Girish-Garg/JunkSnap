import { useTranslation } from 'react-i18next';
import { lookOf } from '../../../domain/ActionAvailability';
import { NOTE_TEXT_MAX, type NoteLanguage } from '../../../domain/Community';
import { Button } from '../../../ui/Button';
import { Segmented } from '../../../ui/Segmented';
import { TextArea } from '../../../ui/TextArea';
import { useNote } from '../hooks/useNote';

interface SiteNoteFormProps {
  readonly siteId: string;
  readonly onAdded: () => void;
}

/** 280 characters in English or Hindi; the note is checked for personal details before anyone sees it. */
export function SiteNoteForm({ siteId, onAdded }: SiteNoteFormProps) {
  const { t } = useTranslation();
  const note = useNote(siteId, onAdded);
  const { sendable } = note;
  const languages = [
    { value: 'en' as NoteLanguage, label: t('notes.english') },
    { value: 'hi' as NoteLanguage, label: t('notes.hindi') },
  ];
  return (
    <form className="site-notes__form" onSubmit={(event) => { event.preventDefault(); sendable.tap(note.submit)(); }}>
      <TextArea id="site-note" label={t('notes.label')} value={note.text} onChange={note.setText} maxLength={NOTE_TEXT_MAX} hint={t('notes.left', { left: note.left })} />
      <Segmented label={t('notes.language')} options={languages} value={note.language} onChange={note.setLanguage} />
      <p className="site-notes__privacy">{t('notes.privacy')}</p>
      <Button type="submit" {...lookOf(sendable.availability)}>{t(note.busy ? 'notes.sending' : 'notes.send')}</Button>
      {note.result && (
        <p className="site-notes__result" role="status">
          {t(note.result.status === 'shown' ? 'notes.shown' : 'notes.hidden')}
        </p>
      )}
      {note.problem && (
        <p className="form__error" role="alert">
          {t(`notes.errors.${note.problem}`)}
        </p>
      )}
    </form>
  );
}
