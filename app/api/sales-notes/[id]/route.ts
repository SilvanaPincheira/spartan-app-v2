// app/api/sales-notes/[id]/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/sales-notes/:id
export async function GET(_: Request, ctx: { params: { id: string } }) {
  try {
    const { id } = ctx.params;
    const { data, error } = await supabase
      .from("sales_notes")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return NextResponse.json({ data, error: null });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message }, { status: 404 });
  }
}

// PATCH /api/sales-notes/:id
// body: campos a actualizar (status, total_amount, notes, pdf_url, document_number, etc)
export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const { id } = ctx.params;
    const body = await req.json();

    const patch: Record<string, any> = {};
    const allowed = [
      "status",
      "total_amount",
      "subtotal",
      "tax",
      "total",
      "notes",
      "pdf_url",
      "document_number",
      "note_date",
      "related_quote",
    ];
    for (const k of allowed) {
      if (k in body) patch[k] = body[k];
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("sales_notes")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data, error: null });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message }, { status: 400 });
  }
}
