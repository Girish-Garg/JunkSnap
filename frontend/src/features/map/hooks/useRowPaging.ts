import { useState } from 'react';
import { useConfig } from '../../../app/useConfig';

/**
 * A page of rows at a time (limits.listPageSize), so a city's 500 sites never mount at once. The first page reaches far enough to hold the row at `keep` (the row last opened), so
 * coming back from the map never hides it; "Show more" adds a page.
 */
export function useRowPaging<T>(rows: readonly T[], keep: number) {
  const { listPageSize: page } = useConfig().limits;
  const [limit, setLimit] = useState(() => Math.max(page, keep + 1));
  const shown = rows.slice(0, limit);
  const more = Math.min(page, Math.max(rows.length - limit, 0));
  return { shown, more, showMore: () => setLimit(limit + page) };
}
