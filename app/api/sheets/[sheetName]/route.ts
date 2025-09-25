export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

function normalize(val: string) {
  return val
    ?.toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w_]/g, "");
}

type Params = { params: { sheetName: string } };

export async function GET(req: Request, { params }: Params) {
  try {
    // 1️⃣ Usuario autenticado
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const email = user?.email?.toLowerCase() ?? "";

    // 2️⃣ Nombre de la hoja (decodificado)
    const sheetName = decodeURIComponent(params.sheetName);

    // Mapear nombres "bonitos" → pestañas reales
    const tabMap: Record<string, string> = {
      Metas: "Hoja 6",
      "Clientes Pendientes": "clientesnuevos",
      "Notas de Venta": "Hoja 1",
    };
    const tabName = tabMap[sheetName] || sheetName;

    const spreadsheetId = process.env.SHEET_ID!;
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;

    console.log("📄 Leyendo hoja:", sheetName, "→ pestaña real:", tabName, "para usuario:", email);

    // 3️⃣ Descargar CSV
    const res = await fetch(url);
    if (!res.ok) {
      console.error("❌ Error al leer hoja:", await res.text());
      return NextResponse.json({ error: "No se pudo leer la hoja" }, { status: 500 });
    }

    const text = await res.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

    // 4️⃣ Normalizar cabeceras
    const headers = parsed.meta.fields?.map(normalize) || [];
    const data = (parsed.data as any[]).map((row) => {
      const obj: any = {};
      headers.forEach((h, i) => {
        const originalKey = parsed.meta.fields?.[i] || "";
        obj[h] = row[originalKey] ?? "";
      });
      return obj;
    });

    // 5️⃣ Decidir si aplicar filtro
    const noFilterSheets = ["Clientes Pendientes", "Notas de Venta"];
    let finalData = data;

    if (!noFilterSheets.includes(sheetName)) {
      finalData = data.filter((row) => {
        const rowEmail = row["email_col"]?.toString().trim().toLowerCase();
        return rowEmail && rowEmail === email;
      });
    }

    console.log("✅ Filas totales:", data.length, "→ Después del filtro:", finalData.length);

    return NextResponse.json({ data: finalData });
  } catch (err) {
    console.error("🔥 Error en API Sheets:", err);
    return NextResponse.json({ error: "Error en servidor" }, { status: 500 });
  }
}
