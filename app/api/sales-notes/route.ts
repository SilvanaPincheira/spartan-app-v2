// app/api/sales-notes/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/sales-notes?status=&customer_id=&from=&to=&page=1&limit=20
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "";
    const customer_id = url.searchParams.get("customer_id") ?? "";
    const fromDate = url.searchParams.get("from"); // YYYY-MM-DD
    const toDate = url.searchParams.get("to");     // YYYY-MM-DD
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? 20)));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let q = supabase
      .from("sales_notes")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (status) q = q.eq("status", status);
    if (customer_id) q = q.eq("customer_id", customer_id);
    if (fromDate) q = q.gte("note_date", fromDate);
    if (toDate) q = q.lte("note_date", toDate);

    const { data, error, count } = await q;
    if (error) throw error;

    return NextResponse.json({ data, count, error: null });
  } catch (e: any) {
    return NextResponse.json({ data: [], count: 0, error: e.message }, { status: 500 });
  }
}

// POST /api/sales-notes
// body: { customer_id: string, note_date?: string(YYYY-MM-DD), related_quote?: string,
//         subtotal?: number, tax?: number, total?: number, total_amount?: number,
//         status?: 'draft'|'sent'|'accepted'|'rejected'|'issued'|'cancelled', notes?: string }
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.customer_id) {
      return NextResponse.json({ error: "customer_id es obligatorio" }, { status: 400 });
    }

    // Valores por defecto y limpieza
    const payload = {
      customer_id: body.customer_id as string,
      note_date: (body.note_date ?? new Date().toISOString().slice(0, 10)) as string,
      related_quote: body.related_quote ?? null,
      // Para columnas money en Postgres puedes enviar número; Postgres lo castea.
      subtotal: body.subtotal ?? 0,
      tax: body.tax ?? 0,
      total: body.total ?? 0,
      total_amount: body.total_amount ?? null, // esta es numeric
      status: (body.status ?? "draft") as
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "issued"
        | "cancelled",
      document_number: body.document_number ?? null,
      pdf_url: body.pdf_url ?? null,
      created_by: body.created_by ?? null,
      notes: (body.notes ?? "").toString().trim() || null,
    };

    const { data, error } = await supabase
      .from("sales_notes")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message }, { status: 400 });
  }
}
