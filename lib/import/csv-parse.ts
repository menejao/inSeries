/**
 * Parser CSV minimo e seguro (RFC 4180: aspas, virgulas/;/tab como separador, quebras de
 * linha dentro de aspas). Sem dependencia externa. Fase 12 — celulas que comecam com
 * caracteres de formula (=, +, -, @) sao neutralizadas no ponto de USO em exportacao;
 * na importacao o valor e tratado como texto puro sempre (nunca executado).
 */
export type ParsedCsv = { headers: string[]; rows: string[][]; separator: string };

const MAX_ROWS = 100_000;

export function detectSeparator(firstLine: string): string {
  const candidates = [",", ";", "\t"];
  let best = ",";
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

export function parseCsv(text: string): ParsedCsv {
  // BOM do Excel/UTF-8
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const firstNewline = clean.indexOf("\n");
  const separator = detectSeparator(firstNewline === -1 ? clean : clean.slice(0, firstNewline));

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];

    if (inQuotes) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === separator) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      if (rows.length > MAX_ROWS) throw new Error("csv_too_many_rows");
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }

  const headers = (rows.shift() ?? []).map((header) => header.trim());
  return { headers, rows, separator };
}

/** Constroi um índice header->coluna, case-insensitive, com aliases. */
export function headerIndex(headers: string[]) {
  const map = new Map<string, number>();
  headers.forEach((header, index) => map.set(header.trim().toLowerCase(), index));
  return {
    find(...names: string[]): number {
      for (const name of names) {
        const index = map.get(name.toLowerCase());
        if (index !== undefined) return index;
      }
      return -1;
    }
  };
}

/** Neutraliza CSV injection ao EXPORTAR (Fase 12/34): prefixa formulas com apostrofe. */
export function csvSafeCell(value: string): string {
  const needsQuote = /[",\n\r;]/.test(value);
  const neutralized = /^[=+\-@]/.test(value) ? `'${value}` : value;
  const escaped = neutralized.replaceAll('"', '""');
  return needsQuote || neutralized !== value ? `"${escaped}"` : escaped;
}
