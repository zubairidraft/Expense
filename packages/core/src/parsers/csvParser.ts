/**
 * Parses raw CSV text into structured records with automatic header detection
 * and quoted field support.
 */
export function parseCsv(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
  if (!csvText || !csvText.trim()) {
    return { headers: [], rows: [] };
  }

  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const rawHeaders = parseLine(lines[0]);
  const headers = rawHeaders.map((h) => h.replace(/^"|"$/g, '').trim());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const rowObj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      rowObj[header] = values[idx] ? values[idx].replace(/^"|"$/g, '').trim() : '';
    });
    rows.push(rowObj);
  }

  return { headers, rows };
}

/**
 * Computes a deterministic 64-bit FNV-1a deduplication hash string from transaction fields.
 */
export function computeDedupeHash(
  date: string,
  amount: string | number,
  payee: string,
  type: string
): string {
  const normDate = (date || '').trim();
  const normAmt = parseFloat(amount as string || '0').toFixed(2);
  const normPayee = (payee || '').toLowerCase().trim();
  const normType = (type || 'expense').toLowerCase().trim();

  const key = `${normDate}|${normAmt}|${normPayee}|${normType}`;

  // FNV-1a 32-bit hash implementation
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Generates formatted CSV string for transactions list.
 */
export function exportTransactionsToCsv(transactions: Array<Record<string, any>>): string {
  const headers = ['Date', 'Title', 'Payee', 'Type', 'Amount', 'Currency', 'Notes', 'Status'];

  const rows = transactions.map((t) => [
    t.date || '',
    `"${(t.title || t.payee_name || '').replace(/"/g, '""')}"`,
    `"${(t.payee_name || '').replace(/"/g, '""')}"`,
    t.type || 'expense',
    t.amount || '0.00',
    t.currency || 'USD',
    `"${(t.notes || '').replace(/"/g, '""')}"`,
    t.status || 'cleared',
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Exports complete workspace snapshot as indented JSON.
 */
export function exportWorkspaceToJson(data: Record<string, any>): string {
  return JSON.stringify(
    {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      ...data,
    },
    null,
    2
  );
}
