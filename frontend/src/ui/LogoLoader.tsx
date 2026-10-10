import { Logo } from './Logo';

/** Waiting on something slow (a letter draft): the camera hops on its shadow above the message. */
export function LogoLoader({ text }: { readonly text: string }) {
  return (
    <div className="logo-loader">
      <Logo markOnly size={56} />
      <span className="logo-loader__shadow" aria-hidden="true" />
      <p className="form__note">{text}</p>
    </div>
  );
}
