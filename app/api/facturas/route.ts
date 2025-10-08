// app/api/facturas/route.ts
import { NextResponse } from "next/server";
import Papa from "papaparse";

/**
 * API: Devuelve las facturas emitidas desde Google Sheets
 * Usada por el dashboard principal (Facturas Emitidas)
 */
export async function GET() {
  try {
    // ✅ URL de tu hoja pública o publicada como CSV
    const SHEET_URL =
      "https://docs.google.com/spreadsheets/d/1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s/export?format=csv&gid=871602912";

    // ⚠️ Reemplaza el ID y GID por los de tu hoja "Facturas Emitidas"
    const res = await fetch(SHEET_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo acceder al CSV de Google Sheets");

    // Parsear el CSV a JSON
    const csv = await res.text();
    const parsed = Papa.parse(csv, { header: true });
    const data = parsed.data.filter((r: any) => r && Object.keys(r).length > 0);

    // Respuesta al dashboard
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("❌ Error cargando facturas:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
