import { NextResponse } from "next/server";

const SHEET_ID = "2PACX-1vR2dwvhSGvvFFPBiRxUgF8Q99HkWJlyoFKLDo6Mmu4HvCH_hJtdyV_7WTrOjkUp6u0pMyAOf543M1UE";
const GID = "0";
const CSV_URL = `https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?gid=${GID}&single=true&output=csv`;

// --- Parser CSV seguro (mantiene comas dentro de comillas)
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
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
    const filas = parseCsv(csv);

    // 🧩 Rellenar N° NV hacia abajo (en caso de celdas vacías)
    let ultimoNumero = "";
    for (const f of filas) {
      const num = f["Número NV"] || f["Numero NV"] || f["N° NV"] || "";
      if (num) ultimoNumero = num.trim();
      else f["Número NV"] = ultimoNumero; // relleno
    }

    // --- Agrupar correctamente ---
    const agrupadas: Record<string, any> = {};
    for (const r of filas) {
      const numeroNV = (r["Número NV"] || r["Numero NV"] || r["N° NV"] || "").trim();
      if (!numeroNV) continue;

      if (!agrupadas[numeroNV]) {
        agrupadas[numeroNV] = {
          numeroNV,
          fecha: r["Fecha"] || "",
          cliente: r["Cliente"] || "",
          rut: r["RUT"] || "",
          codigoCliente: r["Codigo Cliente"] || r["Código Cliente"] || "",
          ejecutivo: r["Ejecutivo"] || r["Empleado Ventas"] || "",
          direccion: r["Direccion"] || r["Dirección"] || "",
          correoEjecutivo: r["Correo Ejecutivo"] || "",
          comentarios: r["Comentarios"] || "",
          subtotal: r["Subtotal"] || "",
          total: r["Total"] || "",
          items: [],
        };
      }

      // 🔹 Solo agregar ítems si hay código válido
      const codigo = r["Código"] || r["Codigo Producto"] || r["ItemCode"] || "";
      const descripcion = r["Descripción"] || r["Producto"] || r["Dscription"] || "";
      if (codigo || descripcion) {
        agrupadas[numeroNV].items.push({
          codigo,
          descripcion,
          cantidad: r["Cantidad"] || r["Quantity"] || "",
          kilos: r["Kg"] || r["Kilos"] || "",
          precioUnitario:
            r["Precio Unitario"] ||
            r["Precio Por Linea"] ||
            r["Precio Venta"] ||
            "",
          descuento: r["% Desc"] || r["Descuento"] || "",
          totalItem: r["Total Item"] || r["Total"] || "",
        });
      }
    }

    const data = Object.values(agrupadas);
    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    console.error("❌ Error en historial-notaventa:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

