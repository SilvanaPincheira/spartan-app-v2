// app/api/facturas/route.ts
import { NextResponse } from "next/server";
import Papa from "papaparse";

/**
 * API: Devuelve las facturas emitidas desde Google Sheets
 * Filtra por email si se pasa como query param (?email=)
 */
export async function GET(req: Request) {
  try {
    // ✅ URL pública de tu hoja "Facturas Emitidas"
    const SHEET_URL =
      "https://docs.google.com/spreadsheets/d/1MY531UHJDhxvHsw6-DwlW8m4BeHwYP48MUSV98UTc1s/export?format=csv&gid=871602912";

    // Leer parámetro de búsqueda (?email=)
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email")?.toLowerCase().trim();

    // Descargar CSV
    const res = await fetch(SHEET_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo acceder al CSV de Google Sheets");

    const csv = await res.text();
    const parsed = Papa.parse(csv, { header: true });
    const rows = parsed.data.filter((r: any) => r && Object.keys(r).length > 0);

    // ✅ Filtrar por email en cualquiera de las columnas
    const filtered = email
      ? rows.filter((r: any) => {
          const email1 = String(r.EMAIL_COL || "").toLowerCase().trim();
          const email2 = String(r.EMAIL_COLUMNA || "").toLowerCase().trim();
          return email1 === email || email2 === email;
        })
      : rows;

    return NextResponse.json({ success: true, data: filtered });
  } catch (err: any) {
    console.error("❌ Error cargando facturas:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
