import { NextResponse } from "next/server";

/* ============================================================================
   ⚙️ CONFIGURACIÓN GOOGLE SHEET
   ============================================================================ */
const SHEET_ID =
  "2PACX-1vR2dwvhSGvvFFPBiRxUgF8Q99HkWJlyoFKLDo6Mmu4HvCH_hJtdyV_7WTrOjkUp6u0pMyAOf543M1UE";
const GID = "0";
const CSV_URL = `https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?gid=${GID}&single=true&output=csv`;

/* ============================================================================
   🧩 Parser CSV seguro (mantiene comas dentro de comillas)
   ============================================================================ */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    const row: Record<string, string> = {};
    headers.forEach(
      (h, j) => (row[h] = (cols[j] || "").replace(/^"|"$/g, "").trim())
    );
    rows.push(row);
  }
  return rows;
}

/* ============================================================================
   🚀 GET — agrupa por N° NV y filtra por login si se pasa ?email=
   ============================================================================ */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const nvParam = (searchParams.get("nv") || "").trim();
    const emailParam = (searchParams.get("email") || "").toLowerCase().trim();

    // Leer sheet público
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok)
      throw new Error("No se pudo acceder al Sheet público (revisa permisos).");

    const csv = await res.text();
    const filas = parseCsv(csv);

    // 🧩 Rellenar N° NV hacia abajo (para celdas vacías)
    let ultimoNumero = "";
    for (const f of filas) {
      const num = f["Número NV"] || f["Numero NV"] || f["N° NV"] || "";
      if (num) ultimoNumero = num.trim();
      else f["Número NV"] = ultimoNumero;
    }

    // 🔍 Filtrar por email (login Supabase)
    let filtradas = filas;
    if (emailParam) {
      filtradas = filtradas.filter((f) => {
        const correo = (f["Correo Ejecutivo"] || "").toLowerCase().trim();
        return correo === emailParam; // 👈 comparación directa, única por login
      });
    }

    // 🔍 Si llega ?nv=..., filtrar aún más
    if (nvParam) {
      filtradas = filtradas.filter((f) => {
        const nv = (f["Número NV"] || f["Numero NV"] || f["N° NV"] || "").trim();
        return nv === nvParam;
      });
    }

    // 🧱 Agrupar por número de NV
    const agrupadas: Record<string, any> = {};
    for (const r of filtradas) {
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
          correoEjecutivo: r["Correo Ejecutivo"] || "",
          direccion: r["Direccion"] || r["Dirección"] || "",
          comentarios: r["Comentarios"] || "",
          subtotal: Number(r["Subtotal"] || 0),
          total: Number(r["Total"] || 0),
          items: [],
        };
      }

      // ⚙️ Agregar ítems válidos
      const codigo = r["Código"] || r["Codigo Producto"] || r["ItemCode"] || "";
      const descripcion =
        r["Descripción"] || r["Producto"] || r["Dscription"] || "";
      if (!codigo && !descripcion) continue;

      agrupadas[numeroNV].items.push({
        numeroNV,
        codigo,
        descripcion,
        cantidad: Number(r["Cantidad"] || r["Quantity"] || 0),
        kilos: Number(r["Kg"] || r["Kilos"] || r["Cantidad Kilos"] || 0),
        precioBase: Number(
          r["Precio base"] ||
            r["Precio Base"] ||
            r["Precio Unitario"] ||
            r["Precio Por Linea"] ||
            0
        ),
        descuento: Number(r["% Desc"] || r["% Descuento"] || r["Descuento"] || 0),
        precioVenta: Number(
          r["Precio venta"] ||
            r["Precio Venta"] ||
            r["Precio Por Linea"] ||
            r["Precio Unitario"] ||
            0
        ),
        totalItem: Number(
          r["Total Item"] ||
            r["Total Línea"] ||
            r["Total Linea"] ||
            r["Total"] ||
            0
        ),
      });
    }

    const data = Object.values(agrupadas);

    if (nvParam && data.length === 0) {
      return NextResponse.json({
        ok: false,
        error: `No se encontró la Nota de Venta ${nvParam} para ${emailParam || "usuario"}`,
      });
    }

    return NextResponse.json({
      ok: true,
      totalNotas: data.length,
      data,
    });
  } catch (err: any) {
    console.error("❌ Error en historial-notaventa:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
