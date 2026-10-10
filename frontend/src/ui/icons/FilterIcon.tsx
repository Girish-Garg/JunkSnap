import { CartoonSvg, type CartoonIconProps } from './CartoonSvg';

/** Two sliders with round knobs. */
export function FilterIcon(props: CartoonIconProps) {
  return (
    <CartoonSvg {...props}>
      <path d="M4 7h16M4 17h16" />
      <circle className="duo" cx="9" cy="7" r="2.6" />
      <circle className="duo2" cx="15" cy="17" r="2.6" />
    </CartoonSvg>
  );
}
