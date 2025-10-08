import { NextResponse } from "next/server";
import Papa from "papaparse";

/**
 * API: Devuelve las facturas emitidas desde Google Sheets
 * Filtradas por correo del ejecutivo (param ?email=)
 */
export async function GET(req: Request) {
  try {
    // ✅ URL de tu hoja pública (modo export CSV)
    const SHEET_URL =
      "https://docs.google.com/spreadsheets/d/1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s/export?format=csv&gid=871602912";

    const res = await fetch(SHEET_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo acceder al CSV de Google Sheets");

    const csv = await res.text();
    const parsed = Papa.parse(csv, { header: true });
    let data = parsed.data.filter((r: any) => r && Object.keys(r).length > 0);

    // 👇 Obtener email desde la query string (?email=...)
    const url = new URL(req.url);
    const email = url.searchParams.get("email");

    // ⚙️ Nombre exacto de la columna donde está el correo del ejecutivo
    const EMAIL_COL = "email_ejecutivo"; // ← cámbialo si tu hoja tiene otro encabezado

    if (email && data.length > 0) {
      // Filtrar por coincidencia exacta o parcial del correo
      data = data.filter((r: any) => {
        const val = (r[EMAIL_COL] || "").toString().toLowerCase().trim();
        return val === email.toLowerCase();
      });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("❌ Error cargando facturas:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
