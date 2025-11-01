import { NextResponse } from "next/server";

/**
 * API para leer el CSV publicado desde Google Sheets y devolver las cotizaciones F&B
 * Hoja pública: Historial Cotizaciones FB
 */

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRt6VEmY8btSUyZLz1sYGBJHFtOL5msJrzGNWmLIKZWgx8EpMMUjJPZRXsZvqwHoe6J9-h1jsTXPA03/pub?gid=1811944760&single=true&output=csv";

/* ===================== PARSER DE CSV ===================== */
function normalizeHeader(str: string): string {
  return str
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[()%]/g, "")
    .replace(/[^a-z0-9_]/g, "");
}

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
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });

    if (!res.ok) {
      throw new Error(`Error ${res.status} al obtener el CSV`);
    }

    const text = await res.text();
    const rows = parseCSV(text);

    return NextResponse.json({
      ok: true,
      count: rows.length,
      data: rows,
    });
  } catch (error: any) {
    console.error("❌ Error leyendo Cotizaciones F&B:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Error al leer CSV" },
      { status: 500 }
    );
  }
}

