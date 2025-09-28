export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

const URL =
  "https://docs.google.com/spreadsheets/d/1_gD_uYjBh3NlWogDqiiU_kkrZTDueQ98kSrGfc92vSg/export?format=csv&gid=0";

function normalize(val: string) {
  return val?.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^\w_]/g, "");
}

export async function GET() {
  try {
    // 1️⃣ Usuario logueado
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const email = user.email?.toLowerCase() ?? "";

    // 2️⃣ Leer Google Sheet en CSV
    const res = await fetch(URL, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Error al leer hoja de Alertas" },
        { status: 500 }
      );
    }

    const text = await res.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

    const headers = parsed.meta.fields?.map(normalize) || [];
    const data = (parsed.data as any[]).map((row) => {
      const obj: any = {};
      headers.forEach((h, i) => {
        obj[h] = row[parsed.meta.fields?.[i] || ""] ?? "";
      });
      return obj;
    });

    // 3️⃣ Filtrar por usuario logueado (EMAIL_COL)
    const filtered = data.filter(
      (row) => row["email_col"]?.toString().trim().toLowerCase() === email
    );

    return NextResponse.json({ data: filtered });
  } catch (err) {
    console.error("🔥 Error API Alertas Clientes Comodatos:", err);
    return NextResponse.json(
      { error: "No se pudo leer Alertas" },
      { status: 500 }
    );
  }
}
