import { CartoonSvg, type CartoonIconProps } from './CartoonSvg';

/** A target with a filled centre. */
export function LocateIcon(props: CartoonIconProps) {
  return (
    <CartoonSvg {...props}>
      <circle className="duo2" cx="12" cy="12" r="6" />
      <circle className="duo" cx="12" cy="12" r="2.2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </CartoonSvg>
  );
}
