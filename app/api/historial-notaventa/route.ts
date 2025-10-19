import { NextResponse } from "next/server";

// === CONFIGURAR TU SHEET PUBLICADA ===
// (usa el link PUBLICADO como CSV, no el de edición)
const SHEET_ID =
  "2PACX-1vR2dwvhSGvvFFPBiRxUgF8Q99HkWJlyoFKLDo6Mmu4HvCH_hJtdyV_7WTrOjkUp6u0pMyAOf543M1UE";
const GID = "0";
const CSV_URL = `https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?gid=${GID}&single=true&output=csv`;

// === PARSEADOR DE CSV ROBUSTO ===
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    .map((h) => h.trim().replace(/^"|"$/g, ""));

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]
      .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
      .map((c) => c.replace(/^"|"$/g, "").trim());

    const row: Record<string, string> = {};
    headers.forEach((h, j) => (row[h] = cols[j] || ""));
    rows.push(row);
  }
  return rows;
}

// === HANDLER GET ===
export async function GET() {
  try {
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo acceder al Sheet público.");
    const csv = await res.text();
    const rows = parseCsv(csv);

    // === Agrupar por N° Nota ===
    const agrupadas: Record<string, any> = {};

    for (const r of rows) {
      const numeroNV =
        r["Número NV"] || r["Numero NV"] || r["N° NV"] || r["Numero"] || "";
      if (!numeroNV) continue;

      // Si no existe aún, crear cabecera
      if (!agrupadas[numeroNV]) {
        agrupadas[numeroNV] = {
          numeroNV,
          fecha: r["Fecha"] || "",
          cliente: r["Cliente"] || "",
          rut: r["RUT"] || r["Rut Cliente"] || "",
          codigoCliente: r["Codigo Cliente"] || r["Código Cliente"] || "",
          ejecutivo: r["Ejecutivo"] || r["Empleado Ventas"] || "",
          direccion: r["Direccion"] || r["Dirección Despacho"] || "",
          correoEjecutivo:
            r["Correo Ejecutivo"] ||
            r["EMAIL_COL"] ||
            r["EMAIL_COLUMNA"] ||
            "",
          comentarios: r["Comentarios"] || "",
          subtotal: r["Subtotal"] || "",
          total: r["Total"] || "",
          items: [],
        };
      }

      // Agregar detalle de ítems
      agrupadas[numeroNV].items.push({
        codigo:
          r["Código"] || r["Codigo Producto"] || r["ItemCode"] || r["Código Producto"] || "",
        descripcion:
          r["Descripción"] || r["Producto"] || r["Dscription"] || "",
        kilos: Number(r["Kg"] || r["Kilos"] || r["Cantidad Kilos"] || 1),
        cantidad: Number(r["Cantidad"] || r["Quantity"] || 0),
        precioBase: Number(r["Precio base"] || r["Precio Base"] || 0),
        precioUnitario:
          Number(r["Precio Unitario"] || r["Precio Por Linea"] || r["Precio venta"] || 0),
        descuento: Number(r["% Desc"] || r["% Descuento"] || 0),
        totalItem:
          Number(r["Total Item"] || r["Total Linea"] || r["Total"] || 0),
      });
    }

    const data = Object.values(agrupadas);
    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    console.error("❌ Error en historial-notaventa:", err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
