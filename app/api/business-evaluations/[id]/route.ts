export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/business-evaluations/:id
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { data, error } = await supabase.from("business_evaluations").select("*").eq("id", params.id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ data });
}

// PATCH /api/business-evaluations/:id
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const patch = await req.json();
    const { data, error } = await supabase.from("business_evaluations").update(patch).eq("id", params.id).select().single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

// DELETE /api/business-evaluations/:id
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { error } = await supabase.from("business_evaluations").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
