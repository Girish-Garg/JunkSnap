import { CartoonSvg, type CartoonIconProps } from './CartoonSvg';

/** A friendly face on shoulders. */
export function AccountIcon(props: CartoonIconProps) {
  return (
    <CartoonSvg {...props}>
      <path className="duo2" d="M4.5 20.5c1-3.8 4-5.5 7.5-5.5s6.5 1.7 7.5 5.5z" />
      <circle className="duo" cx="12" cy="8" r="4.5" />
      <path d="M10.3 9.4q1.7 1.4 3.4 0" />
      <circle className="dot" cx="10.4" cy="7.2" r="0.9" />
      <circle className="dot" cx="13.6" cy="7.2" r="0.9" />
    </CartoonSvg>
  );
}
