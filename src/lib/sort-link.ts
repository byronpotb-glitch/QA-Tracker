export type SortDir = "asc" | "desc";

/**
 * Builds the href for a sortable column header: clicking the active column
 * flips direction, clicking a different column jumps to its own default
 * direction (e.g. numeric/date columns default to highest/most-recent first).
 * Sorting always resets to page 1 since the result order changes.
 */
export function buildSortHref(
  basePath: string,
  currentParams: Record<string, string | undefined>,
  columnKey: string,
  defaultDir: SortDir
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(currentParams)) {
    if (value !== undefined && key !== "sort" && key !== "dir" && key !== "page") {
      params.set(key, value);
    }
  }

  const isActive = currentParams.sort === columnKey;
  const nextDir: SortDir = isActive
    ? currentParams.dir === "asc"
      ? "desc"
      : "asc"
    : defaultDir;

  params.set("sort", columnKey);
  params.set("dir", nextDir);

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
