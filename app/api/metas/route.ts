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

export async function GET() {
  try {
    // 1️⃣ Usuario autenticado
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const email = user.email?.toLowerCase() ?? "";

    // 2️⃣ URL directa de Google Sheets (formato CSV)
    const url =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vQeg3EGhKOHiA9cRDqPioN5oaHZUOpDxB1olx-H6jkUIdBnyRvgEBJwe3IQeb3N7e9rnsQy4UnOQlk1/pub?gid=1307997110&single=true&output=csv";

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.error("❌ Error al leer hoja:", await res.text());
      return NextResponse.json(
        { error: "No se pudo leer la hoja" },
        { status: 500 }
      );
    }

    // 3️⃣ Parsear CSV
    const text = await res.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

    // 4️⃣ Normalizar cabeceras
    const headers = parsed.meta.fields?.map(normalize) || [];

    // 5️⃣ Crear objetos normalizados + corrección de columnas duplicadas
    const data = (parsed.data as any[]).map((row) => {
      const obj: any = {};

      headers.forEach((h, i) => {
        const original = parsed.meta.fields?.[i] || "";
        obj[h] = row[original] ?? "";
      });

      // ✅ Corrección manual para las columnas que se pisan
      if (row["Cumplimiento $"] !== undefined)
        obj["cumplimiento_dinero"] = row["Cumplimiento $"];
      if (row["Cumplimiento %"] !== undefined)
        obj["cumplimiento_porcentaje"] = row["Cumplimiento %"];
      if (row["META_MARZO_2026"] !== undefined)
        obj["meta_marzo_2026"] = row["META_MARZO_2026"];

      return obj;
    });

    // 6️⃣ Filtrar por email del usuario
    const filtered = data.filter(
      (row) => row["email_col"]?.toLowerCase() === email
    );

    // 7️⃣ Definir columnas que se van a devolver
    const columnasOrdenadas = [
      "zona_chile",
      "gerencia",
      "supervisor",
      "vendedor",
      "pedido",
      "entrega",
      "total_quimicos",
      "no_son_equipo_venta",
      "meta_marzo_2026",
      "cumplimiento_dinero",
      "cumplimiento_porcentaje",
    ];

    // 8️⃣ Crear arreglo limpio con solo esas columnas
    const cleaned = filtered.map((row) => {
      const obj: any = {};
      columnasOrdenadas.forEach((col) => {
        obj[col] = row[col] ?? "";
      });
      return obj;
    });

    console.log("✅ Metas:", cleaned.length, "filas para", email);

    // 9️⃣ Devolver resultado
    return NextResponse.json({ data: cleaned });
  } catch (err) {
    console.error("🔥 Error en API Metas:", err);
    return NextResponse.json({ error: "Error en servidor" }, { status: 500 });
  }
}
