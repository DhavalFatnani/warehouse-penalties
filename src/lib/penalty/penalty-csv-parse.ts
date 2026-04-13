/**
 * Penalty import CSV: tolerate commas inside the last column (e.g. notes) without
 * requiring quotes. Commas inside double-quoted fields never split. Standard CSV
 * quoting still works for any column.
 */

export function splitCsvLineAllFields(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let i = 0;
  let inQuotes = false;
  while (i < line.length) {
    const c = line[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cur += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      out.push(cur);
      cur = "";
      i += 1;
      continue;
    }
    cur += c;
    i += 1;
  }
  out.push(cur);
  return out;
}

/** Split into exactly `fieldCount` fields; field at index `fieldCount - 1` keeps any extra commas. */
export function splitCsvLineToFixedFields(
  line: string,
  fieldCount: number
): string[] {
  if (fieldCount < 1) return [];
  const out: string[] = [];
  let cur = "";
  let i = 0;
  let inQuotes = false;
  while (i < line.length) {
    const c = line[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cur += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === "," && out.length < fieldCount - 1) {
      out.push(cur);
      cur = "";
      i += 1;
      continue;
    }
    cur += c;
    i += 1;
  }
  out.push(cur);
  while (out.length < fieldCount) {
    out.push("");
  }
  return out.slice(0, fieldCount);
}

function normalizeHeaderCell(h: string): string {
  return h.replace(/^\ufeff/, "").trim().toLowerCase();
}

export type PenaltyCsvParseError = { message: string; row: number };

export function parsePenaltyImportCsv(csvText: string): {
  data: Record<string, string>[];
  errors: PenaltyCsvParseError[];
} {
  const text = csvText.replace(/^\ufeff/, "").replace(/\r\n/g, "\n");
  const rawLines = text.split("\n");
  const lines: string[] = [];
  for (const l of rawLines) {
    const t = l.trimEnd();
    if (t.length > 0) lines.push(t);
  }

  if (lines.length === 0) {
    return { data: [], errors: [{ message: "Empty file", row: 0 }] };
  }

  const headerCells = splitCsvLineAllFields(lines[0]!).map((c) =>
    normalizeHeaderCell(c)
  );
  if (headerCells.length === 0 || headerCells.every((h) => h === "")) {
    return { data: [], errors: [{ message: "Missing or invalid header row", row: 1 }] };
  }

  if (headerCells.some((h) => h === "")) {
    return {
      data: [],
      errors: [
        {
          message: "Header row has empty column names; remove extra commas.",
          row: 1
        }
      ]
    };
  }

  const fieldCount = headerCells.length;
  const data: Record<string, string>[] = [];

  for (let li = 1; li < lines.length; li++) {
    const cells = splitCsvLineToFixedFields(lines[li]!, fieldCount).map((c) =>
      c.trim()
    );
    const row: Record<string, string> = {};
    for (let j = 0; j < headerCells.length; j++) {
      const key = headerCells[j]!;
      row[key] = cells[j] ?? "";
    }
    if (Object.values(row).every((v) => v === "")) {
      continue;
    }
    data.push(row);
  }

  return { data, errors: [] };
}
