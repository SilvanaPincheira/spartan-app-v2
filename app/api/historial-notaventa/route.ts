// app/api/historial-notaventa/route.ts
import { NextResponse } from "next/server";

async function fetchCsvFromGoogleSheet(spreadsheetId: string, gid: string) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Error al leer Sheet (${res.status})`);
  const text = await res.text();

  const rows = text.split("\n").map((r) => r.split(","));
  const headers = rows[0] || [];
  const data = rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h.trim()] = (r[i] || "").trim()));
    return obj;
  });

  return data;
}

export async function GET() {
  try {
    // 🧾 usa el mismo sheet donde se guardan las NV
    // (reemplaza el ID y gid por los mismos que usa tu /api/save-to-sheets)
    const spreadsheetId = "https://script.google.com/macros/s/AKfycbw7j06u3MQAWCMWHrOEuWnzcQZ1W4V3lDARSY7sFy5eqigAUgUsawRgZpEu9-SNVgD7/exec"; // ejemplo
    const gid = "0"; // cambia si tu hoja de NV está en otro gid

    const rows = await fetchCsvFromGoogleSheet(spreadsheetId, gid);

    // Limpieza y formato
    const notas = rows
      .map((r) => ({
        numeroNV: r["numeroNV"] || r["N° Nota Venta"] || "",
        fechaHora: r["fechaHora"] || r["Fecha"] || "",
        cliente: r["cliente"] || r["Cliente"] || "",
        rut: r["rut"] || r["RUT"] || "",
        codigoCliente: r["codigoCliente"] || r["Código Cliente"] || "",
        ejecutivo: r["ejecutivo"] || r["Ejecutivo"] || "",
        total: Number(r["total"] || r["Total"] || 0),
      }))
      .filter((n) => n.numeroNV);

    return NextResponse.json({ ok: true, data: notas });
  } catch (e: any) {
    console.error("❌ Error historial-notaventa:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
