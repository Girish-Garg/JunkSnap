import { useTranslation } from 'react-i18next';

/** The judge's reason, already cleaned (RationaleSanitizer); React renders it as plain text, never markup. */
export function ConfirmReason({ text }: { readonly text: string | null }) {
  const { t } = useTranslation();
  if (!text) return null;
  return (
    <figure className="confirm-ask__reason">
      <figcaption className="feedback-judge__label">{t('confirm.reasonLabel')}</figcaption>
      <blockquote className="feedback-judge__quote" lang="en">
        {text}
      </blockquote>
    </figure>
  );
}
