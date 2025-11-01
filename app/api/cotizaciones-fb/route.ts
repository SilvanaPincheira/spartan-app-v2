import { NextResponse } from "next/server";

/**
 * Lee el CSV publicado desde Google Sheets y devuelve los registros como JSON
 * URL pública actual:
 * https://docs.google.com/spreadsheets/d/e/2PACX-1vRt6VEmY8btSUyZLz1sYGBJHFtOL5msJrzGNWmLIKZWgx8EpMMUjJPZRXsZvqwHoe6J9-h1jsTXPA03/pub?gid=1811944760&single=true&output=csv
 */

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRt6VEmY8btSUyZLz1sYGBJHFtOL5msJrzGNWmLIKZWgx8EpMMUjJPZRXsZvqwHoe6J9-h1jsTXPA03/pub?gid=1811944760&single=true&output=csv";

/* ===================== UTILIDAD: NORMALIZAR CABECERAS ===================== */
function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // quita acentos
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_") // espacios -> guión bajo
    .replace(/[()]/g, "")
    .replace(/%/g, "pct")
    .replace(/[^a-z0-9_]/g, ""); // elimina símbolos
}

/* ===================== PARSER DE CSV ROBUSTO ===================== */
function parseCSV(csvText: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const c = csvText[i];
    const next = csvText[i + 1];

    if (c === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
    } else if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      row.push(cur);
      cur = "";
    } else if ((c === "\n" || c === "\r") && !inQuotes) {
      if (cur.length || row.length) {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
      }
      if (c === "\r" && next === "\n") i++;
    } else {
      cur += c;
    }
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map((h) => normalizeHeader(h));
  const data: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((x) => x.trim() === "")) continue;

    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => (obj[h] = (r[idx] ?? "").trim()));
    data.push(obj);
  }

  return data;
}

/* ===================== HANDLER PRINCIPAL ===================== */
export async function GET() {
  try {
    const res = await fetch(`${SHEET_CSV_URL}&t=${Date.now()}`, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });

    if (!res.ok) throw new Error(`Error ${res.status} al obtener el CSV`);

    const text = await res.text();
    const data = parseCSV(text);

    return NextResponse.json({ ok: true, count: data.length, data });
  } catch (error: any) {
    console.error("❌ Error leyendo Cotizaciones F&B:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Error al leer CSV" },
      { status: 500 }
    );
  }
}
