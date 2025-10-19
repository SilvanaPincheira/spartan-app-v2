import { NextResponse } from "next/server";

export async function GET() {
  try {
    // ✅ Tu hoja pública en formato CSV
    const url =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vR2dwvhSGvvFFPBiRxUgF8Q99HkWJlyoFKLDo6Mmu4HvCH_hJtdyV_7WTrOjkUp6u0pMyAOf543M1UE/pub?output=csv";

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Error HTTP ${res.status}`);

    const text = await res.text();
    const rows = text.split("\n").map((r) => r.split(","));
    const headers = rows[0]?.map((h) => h.trim().toLowerCase()) || [];

    const data = rows.slice(1).map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => (obj[h] = (r[i] || "").trim()));
      return obj;
    });

    const notas = data
      .map((r) => ({
        numeroNV:
          r["número nv"] || r["numero nv"] || r["n° nv"] || r["n° nota de venta"] || "",
        fecha: r["fecha"] || "",
        cliente: r["cliente"] || "",
        rut: r["rut"] || "",
        ejecutivo: r["empleado ventas"] || r["ejecutivo"] || "",
        total: r["total"] || "",
      }))
      .filter((n) => n.numeroNV);

    return NextResponse.json({ ok: true, data: notas });
  } catch (e: any) {
    console.error("❌ Error en historial-notaventa:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
