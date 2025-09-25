export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  try {
    // 1️⃣ Obtener usuario autenticado
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // 2️⃣ Leer hoja de Google Sheets
    const sheets = google.sheets("v4");
    const data = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID!, // ID de tu hoja
      range: "Customers!A:Z",               // Ajusta rango y hoja
      auth: process.env.GOOGLE_API_KEY!,
    });

    const rows = data.data.values ?? [];
    if (rows.length === 0) {
      return NextResponse.json({ data: [], error: null });
    }

    // 3️⃣ Filtrar por email del usuario
    const header = rows[0];
    const emailIndex = header.indexOf("EMAIL_COL");
    const filtered = rows.filter(
      (row, i) => i === 0 || row[emailIndex] === user.email
    );

    return NextResponse.json({ data: filtered, error: null });
  } catch (e: any) {
    return NextResponse.json({ data: [], error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json();
    if (!body?.name) {
      return NextResponse.json({ error: "name es obligatorio" }, { status: 400 });
    }

    // ⚡ Armar fila a insertar (incluye el email del usuario)
    const payload = [
      body.rut ?? "",
      body.name,
      body.address ?? "",
      body.city ?? "",
      body.contact_email ?? "",
      body.contact_phone ?? "",
      user.email, // ← se guarda el dueño del registro
    ];

    const sheets = google.sheets("v4");
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SHEET_ID!,
      range: "Customers!A:Z",
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

