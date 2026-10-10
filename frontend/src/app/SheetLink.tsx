import type { MouseEvent, ReactNode } from 'react';
import { Link } from 'react-router';
import { useSheetNavigation } from './useSheetNavigation';

interface SheetLinkProps {
  readonly to: string;
  readonly className?: string;
  readonly children: ReactNode;
}

// A click that asks for a new tab or window keeps the browser's own handling.
function plainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/**
 * A link that opens a sheet on top of the current one. It goes through useSheetNavigation.open, so open
 * layers (a focused field's entry, Filters) come off the stack first and none is left under the new sheet.
 * It stays a real link: the address shows on hover and a middle click opens a new tab.
 */
export function SheetLink({ to, className, children }: SheetLinkProps) {
  const sheets = useSheetNavigation();
  const onClick = (event: MouseEvent) => {
    if (!plainClick(event)) return;
    event.preventDefault();
    sheets.open(to);
  };
  return (
    <Link className={className} to={to} state={sheets.linkState} onClick={onClick}>
      {children}
    </Link>
  );
}
