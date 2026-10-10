/**
 * Client-side file trigger and filename generation
 */

/**
 * Triggers a native browser file download from a Blob
 */
export function triggerBlobDownload(blob, filename) {
  if (typeof window === 'undefined') return;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();

  // Cleanup object URL after a brief delay
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Builds a descriptive, filesystem-safe filename with date range and applied filters.
 * e.g., ExpensePro_Report_2026-10-01_to_2026-10-31_Food_HBL.xlsx
 */
export function buildExportFilename({
  prefix = 'ExpensePro_Report',
  startDate = '',
  endDate = '',
  filterTags = [],
  extension = 'csv',
}) {
  const sanitizeSlug = (s) =>
    String(s || '')
      .trim()
      .replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 30);

  const parts = [prefix];

  if (startDate && endDate) {
    parts.push(`${startDate}_to_${endDate}`);
  } else if (startDate) {
    parts.push(`from_${startDate}`);
  } else if (endDate) {
    parts.push(`until_${endDate}`);
  }

  if (Array.isArray(filterTags) && filterTags.length > 0) {
    const slugTags = filterTags
      .filter(Boolean)
      .map(sanitizeSlug)
      .filter((s) => s.length > 0)
      .slice(0, 3)
      .join('_');

    if (slugTags) parts.push(slugTags);
  }

  const cleanExt = extension.replace(/^\./, '');
  return `${parts.join('_')}.${cleanExt}`;
}
