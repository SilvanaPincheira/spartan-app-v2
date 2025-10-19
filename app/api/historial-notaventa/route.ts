import { NextResponse } from "next/server";

/* ============================================================================
   ⚙️ CONFIGURACIÓN GOOGLE SHEET
   ============================================================================ */
const SHEET_ID =
  "2PACX-1vR2dwvhSGvvFFPBiRxUgF8Q99HkWJlyoFKLDo6Mmu4HvCH_hJtdyV_7WTrOjkUp6u0pMyAOf543M1UE";
const GID = "0";
const CSV_URL = `https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?gid=${GID}&single=true&output=csv`;

/* ============================================================================
   🧩 Función parseCsv — respeta comas dentro de comillas
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
   🚀 API GET — opcionalmente filtra por ?nv=NV-XXXX
   ============================================================================ */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const nvParam = (searchParams.get("nv") || "").trim();

    // 🔹 Leer Sheet
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo acceder al Sheet público.");

    const csv = await res.text();
    const filas = parseCsv(csv);

    // 🧩 Propagar N° NV hacia abajo (para celdas vacías)
    let ultimoNumero = "";
    for (const f of filas) {
      const num = f["Número NV"] || f["Numero NV"] || f["N° NV"] || "";
      if (num) ultimoNumero = num.trim();
      else f["Número NV"] = ultimoNumero;
    }

    // 🔍 Si se solicita ?nv=..., filtrar antes de agrupar
    const filtradas = nvParam
      ? filas.filter((f) => {
          const nv = (f["Número NV"] || f["Numero NV"] || f["N° NV"] || "").trim();
          return nv === nvParam;
        })
      : filas;

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
          direccion:
            r["Direccion"] ||
            r["Dirección"] ||
            r["Direccion Despacho"] ||
            "",
          correoEjecutivo: r["Correo Ejecutivo"] || "",
          comentarios: r["Comentarios"] || "",
          subtotal: Number(r["Subtotal"] || 0),
          total: Number(r["Total"] || 0),
          items: [],
        };
      }

      // Solo agregar ítems válidos
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

    // 🧾 Resultado final
    const data = Object.values(agrupadas);

    // Si se pidió una NV específica y no se encontró, devolver vacío controlado
    if (nvParam && data.length === 0) {
      return NextResponse.json({
        ok: false,
        error: `No se encontró la Nota de Venta ${nvParam}`,
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
