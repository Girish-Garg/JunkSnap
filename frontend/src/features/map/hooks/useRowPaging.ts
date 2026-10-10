import { useState } from 'react';

// Rows render a page at a time: a city's 500 sites never mount at once.
export const LIST_PAGE = 30;

/**
 * A page of rows at a time. The first page reaches far enough to hold the row at `keep` (the row last opened), so
 * coming back from the map never hides it; "Show more" adds a page.
 */
export function useRowPaging<T>(rows: readonly T[], keep: number) {
  const [limit, setLimit] = useState(() => Math.max(LIST_PAGE, keep + 1));
  const shown = rows.slice(0, limit);
  const more = Math.min(LIST_PAGE, Math.max(rows.length - limit, 0));
  return { shown, more, showMore: () => setLimit(limit + LIST_PAGE) };
}
