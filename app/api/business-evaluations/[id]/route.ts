export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

type Params = { params: { id: string } };

async function getSheetRows() {
  const sheets = google.sheets("v4");
  const data = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID!,
    range: "BusinessEvaluations!A:Z", // ajusta según tu hoja
    auth: process.env.GOOGLE_API_KEY!,
  });
  return data.data.values ?? [];
}

// GET /api/business-evaluations/:id
export async function GET(_req: Request, { params }: Params) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const rows = await getSheetRows();
    if (rows.length === 0) return NextResponse.json({ error: "Sin datos" }, { status: 404 });

    const header = rows[0];
    const emailIndex = header.indexOf("EMAIL_COL");

    const rowIndex = parseInt(params.id, 10);
    if (isNaN(rowIndex) || rowIndex <= 0 || rowIndex >= rows.length) {
      return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    }

    const row = rows[rowIndex];
    if (row[emailIndex] !== user.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    return NextResponse.json({ data: row });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH /api/business-evaluations/:id
export async function PATCH(req: Request, { params }: Params) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const rows = await getSheetRows();
    if (rows.length === 0) return NextResponse.json({ error: "Sin datos" }, { status: 404 });

    const header = rows[0];
    const emailIndex = header.indexOf("EMAIL_COL");

    const rowIndex = parseInt(params.id, 10);
    if (isNaN(rowIndex) || rowIndex <= 0 || rowIndex >= rows.length) {
      return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    }

    const row = rows[rowIndex];
    if (row[emailIndex] !== user.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Leer cambios del body
    const body = await req.json();

    // Construir nueva fila con los valores actualizados
    const updatedRow = [
      body.customer_id ?? row[0],
      body.eval_date ?? row[1],
      body.months_contract ?? row[2],
      body.avg_monthly_sales ?? row[3],
      body.monthly_lease ?? row[4],
      body.relation_lease_sales ?? row[5],
      body.commission_pct ?? row[6],
      body.status ?? row[7],
      body.comments ?? row[8],
      user.email, // siempre asegurar dueño
    ];

    // Guardar en la fila correspondiente
    const sheets = google.sheets("v4");
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SHEET_ID!,
      range: `BusinessEvaluations!A${rowIndex + 1}:Z${rowIndex + 1}`, // fila exacta
      valueInputOption: "RAW",
      requestBody: { values: [updatedRow] },
      auth: process.env.GOOGLE_API_KEY!,
    });

    return NextResponse.json({ data: updatedRow });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
