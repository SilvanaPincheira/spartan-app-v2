// app/api/sales-notes/[id]/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY!
);

// GET /api/sales-notes/:id
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { data, error } = await supabase.from("sales_notes").select("*").eq("id", params.id).single();
  return NextResponse.json({ data, error }, { status: error ? 404 : 200 });
}

// PATCH /api/sales-notes/:id  (ej. cambiar status o total_amount)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const patch = await req.json();
    const allowed = ["status","total_amount","notes"];
    const upd: Record<string, any> = {};
    for (const k of allowed) if (patch[k] !== undefined) upd[k] = patch[k];

    const { data, error } = await supabase.from("sales_notes").update(upd).eq("id", params.id).select().single();
    return NextResponse.json({ data, error }, { status: error ? 400 : 200 });
  } catch (e:any) {
    return NextResponse.json({ data:null, error: e.message }, { status: 500 });
  }
}

// DELETE /api/sales-notes/:id
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const { error } = await supabase.from("sales_notes").delete().eq("id", params.id);
  return NextResponse.json({ ok: !error, error }, { status: error ? 400 : 200 });
}
