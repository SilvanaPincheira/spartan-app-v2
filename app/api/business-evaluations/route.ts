export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// GET /api/business-evaluations
export async function GET(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const sheets = google.sheets("v4");
    const data = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID!,   // tu hoja
      range: "BusinessEvaluations!A:Z",       // ajusta el rango
      auth: process.env.GOOGLE_API_KEY!,
    });

    const rows = data.data.values ?? [];
    if (rows.length === 0) return NextResponse.json({ data: [] });

    const header = rows[0];
    const emailIndex = header.indexOf("EMAIL_COL");

    // Filtrar por email del usuario
    const filtered = rows.filter((row, i) => i === 0 || row[emailIndex] === user.email);

    return NextResponse.json({ data: filtered });
  } catch (e: any) {
    return NextResponse.json({ data: [], error: e.message }, { status: 500 });
  }
}

// POST /api/business-evaluations
export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const b = await req.json();
    if (!b.eval_date) {
      return NextResponse.json({ error: "eval_date es obligatorio (YYYY-MM-DD)" }, { status: 400 });
    }
    if (!b.months_contract && b.months_contract !== 0) {
      return NextResponse.json({ error: "months_contract es obligatorio" }, { status: 400 });
    }
    if (!["viable", "no_viable"].includes(b.status ?? "")) {
      return NextResponse.json({ error: "status debe ser 'viable' o 'no_viable'" }, { status: 400 });
    }

    const payload = [
      b.customer_id ?? "",
      b.eval_date,
      Number(b.months_contract),
      b.avg_monthly_sales ?? 0,
      b.monthly_lease ?? 0,
      b.relation_lease_sales ?? 0,
      b.commission_pct ?? 0,
      b.status,
      (b.comments ?? "").toString().trim(),
      user.email,  // ← se asocia al usuario logeado
    ];

    const sheets = google.sheets("v4");
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SHEET_ID!,
      range: "BusinessEvaluations!A:Z",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [payload] },
      auth: process.env.GOOGLE_API_KEY!,
    });

    return NextResponse.json({ data: payload, error: null }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message }, { status: 400 });
  }
}
