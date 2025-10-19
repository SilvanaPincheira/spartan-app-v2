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
    // 🔗 Hoja oficial de Notas de Venta (verificada)
    const spreadsheetId = "1NwDx-X8N4qmKiNAx-cH7YlzLxol98gNlLvaWqlvr5c";
    const gid = "0";

    const rows = await fetchCsvFromGoogleSheet(spreadsheetId, gid);

    // 🧹 Limpieza y formato de salida
    const notas = rows
      .map((r) => ({
        numeroNV: r["Número NV"] || r["Numero NV"] || r["numeroNV"] || "",
        fecha: r["Fecha"] || "",
        cliente: r["Cliente"] || r["Nombre Cliente"] || "",
        rut: r["RUT"] || r["Rut"] || "",
        ejecutivo: r["Ejecutivo"] || "",
        total: r["Total"] || "",
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

