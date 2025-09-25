export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

type Params = { params: { id: string } };

async function getSheetRows() {
  const sheets = google.sheets("v4");
  const data = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID!,
    range: "Customers!A:Z",
    auth: process.env.GOOGLE_API_KEY!,
  });
  return data.data.values ?? [];
}

// GET /api/customers/:id
export async function GET(_req: Request, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const rows = await getSheetRows();
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
}

// PUT /api/customers/:id
export async function PUT(req: Request, { params }: Params) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const rows = await getSheetRows();
  const header = rows[0];
  const emailIndex = header.indexOf("EMAIL_COL");
  const rowIndex = parseInt(params.id, 10);

  if (isNaN(rowIndex) || rowIndex <= 0 || rowIndex >= rows.length) {
    return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
  }
  if (rows[rowIndex][emailIndex] !== user.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const updatedRow = [
    body.rut ?? "",
    body.name,
    body.address ?? "",
    body.city ?? "",
    body.contact_email ?? "",
    body.contact_phone ?? "",
    user.email,
  ];

  const sheets = google.sheets("v4");
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.SHEET_ID!,
    range: `Customers!A${rowIndex + 1}:Z${rowIndex + 1}`, // fila exacta
    valueInputOption: "RAW",
    requestBody: { values: [updatedRow] },
    auth: process.env.GOOGLE_API_KEY!,
  });

  return NextResponse.json({ data: updatedRow });
}

// DELETE /api/customers/:id
export async function DELETE(_req: Request, { params }: Params) {
  // ⚠️ En Google Sheets no existe delete de fila vía API directamente
  // Solo puedes sobrescribir la fila con valores vacíos.
  return NextResponse.json({ error: "DELETE no implementado en Sheets" }, { status: 501 });
}

