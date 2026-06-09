import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

const URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR2dwvhSGvvFFPBiRxUgF8Q99HkWJlyoFKLDo6Mmu4HvCH_hJtdyV_7WTrOjkUp6u0pMyAOf543M1UE/pub?output=csv";

function normalize(val: string) {
  return val?.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^\w_]/g, "");
}

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const email = user.email?.toLowerCase() ?? "";

    const res = await fetch(URL);
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

    const filtered = data.filter(
      (row) => row["email_col"]?.toString().trim().toLowerCase() === email
    );

    return NextResponse.json({ data: filtered });
  } catch (err) {
    return NextResponse.json({ error: "No se pudo leer Notas de Venta" }, { status: 500 });
  }
}
