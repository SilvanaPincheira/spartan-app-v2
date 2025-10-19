import { NextResponse } from "next/server";

// === CONFIGURAR TU SHEET PUBLICADA ===
// (usa el link publicado como CSV, no el de edición)
const SHEET_ID = "2PACX-1vR2dwvhSGvvFFPBiRxUgF8Q99HkWJlyoFKLDo6Mmu4HvCH_hJtdyV_7WTrOjkUp6u0pMyAOf543M1UE";
const GID = "0";
const CSV_URL = `https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?gid=${GID}&single=true&output=csv`;

// === PARSEADOR DE CSV SIMPLE ===
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // respeta comas dentro de comillas
    const row: Record<string, string> = {};
    headers.forEach((h, j) => (row[h] = (cols[j] || "").replace(/^"|"$/g, "").trim()));
    rows.push(row);
  }
  return rows;
}

export async function GET() {
  try {
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo acceder al Sheet público.");
    const csv = await res.text();
    const rows = parseCsv(csv);

    // === Agrupar por N° Nota ===
    const agrupadas: Record<string, any> = {};
    for (const r of rows) {
      const numeroNV = r["Número NV"] || r["Numero NV"] || r["N° NV"] || "";
      if (!numeroNV) continue;

      if (!agrupadas[numeroNV]) {
        agrupadas[numeroNV] = {
          numeroNV,
          fecha: r["Fecha"] || r["fecha"] || "",
          cliente: r["Cliente"] || r["cliente"] || "",
          rut: r["RUT"] || r["Rut Cliente"] || "",
          ejecutivo: r["Ejecutivo"] || r["Empleado Ventas"] || "",
          total: r["Total"] || r["total"] || "",
          items: [],
        };
      }

      agrupadas[numeroNV].items.push({
        codigo: r["Código"] || r["Codigo Producto"] || r["ItemCode"] || "",
        descripcion: r["Descripción"] || r["Producto"] || r["Dscription"] || "",
        cantidad: r["Cantidad"] || r["Quantity"] || "",
        kilos: r["Cantidad Kilos"] || r["Kilos"] || "",
        precioUnitario: r["Precio Unitario"] || r["Precio Por Linea"] || "",
        descuento: r["% Descuento"] || "",
        totalItem: r["Total"] || r["Total Linea"] || "",
      });
    }

    const data = Object.values(agrupadas);
    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    console.error("❌ Error en historial-notaventa:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
