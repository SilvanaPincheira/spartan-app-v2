// app/api/metas/route.ts
import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET() {
  try {
    // 1️⃣ Validar usuario logeado
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // 2️⃣ Descargar CSV de Google Sheets (pestaña Hoja 6)
    const url =
      "https://docs.google.com/spreadsheets/d/1GASOV0vI85q5TtVn5hdZFD0Mwcj2SzXM6Iqvgl50A/gviz/tq?tqx=out:csv&sheet=Hoja 6";

    const res = await fetch(url);
    const text = await res.text();

    // 3️⃣ Parsear CSV
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    });

    // 4️⃣ Normalizar cabeceras
    const normalize = (val: string) =>
      val
        ?.toLowerCase()
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^\w_]/g, "");

    const headers = parsed.meta.fields?.map(normalize) || [];
    const data = (parsed.data as any[]).map((row) => {
      const obj: any = {};
      headers.forEach((h, i) => {
        const originalKey = parsed.meta.fields?.[i] || "";
        obj[h] = row[originalKey] ?? "";
      });
      return obj;
    });

    // 5️⃣ Filtrar por email del usuario
    const emailCol = headers.find((h) => h.includes("email"));
    const filtered = emailCol
      ? data.filter((row) => row[emailCol]?.toLowerCase() === user.email?.toLowerCase())
      : data;

    return NextResponse.json({ data: filtered });
  } catch (err) {
    console.error("Error leyendo hoja Metas:", err);
    return NextResponse.json({ error: "Error en servidor" }, { status: 500 });
  }
}
