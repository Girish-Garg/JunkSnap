import { CartoonSvg, type CartoonIconProps } from './CartoonSvg';

/** A printer with a sheet coming out. */
export function PrintIcon(props: CartoonIconProps) {
  return (
    <CartoonSvg {...props}>
      <path className="duo2" d="M5 9.5h14a1.5 1.5 0 0 1 1.5 1.5v6h-17v-6a1.5 1.5 0 0 1 1.5-1.5z" />
      <path d="M7.5 9.5v-5h9v5" />
      <path className="duo" d="M7.5 14.5h9v6h-9z" />
    </CartoonSvg>
  );
}
