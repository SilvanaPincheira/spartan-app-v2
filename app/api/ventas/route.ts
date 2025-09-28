import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

const URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ5pwU5ejrJxqeIqhK4rE3S6II3jPMZAetsoA2ZjaV3XspsxMmVneryY5HeyhwsbaZP22eOfFsF1toL/pub?output=csv&sheet=Ventas";

function normalize(val: string) {
  return val?.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^\w_]/g, "");
}

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const email = user.email?.toLowerCase() ?? "";

    const res = await fetch(URL, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: "Error al leer hoja de Ventas" }, { status: 500 });
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

    // Admins → ven todo
    const admins = ["silvana.pincheira@spartan.cl", "jorge.beltran@spartan.cl"];
    let filtered = data;
    if (!admins.includes(email)) {
      const emailColKey = headers.find((h) => h.startsWith("email"));
      filtered = data.filter(
        (row) => row[emailColKey || ""]?.toString().trim().toLowerCase() === email
      );
    }

    return NextResponse.json({ data: filtered });
  } catch (err) {
    console.error("🔥 Error API Ventas:", err);
    return NextResponse.json({ error: "No se pudo leer Ventas" }, { status: 500 });
  }
}
