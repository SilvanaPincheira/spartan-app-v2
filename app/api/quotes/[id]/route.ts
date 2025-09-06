// app/api/quotes/[id]/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // backend-only
);

type Params = { params: { id: string } };

/** GET /api/quotes/:id */
export async function GET(_req: Request, { params }: Params) {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ data });
}

/** PUT /api/quotes/:id */
export async function PUT(req: Request, { params }: Params) {
  const body = await req.json();

  // Puedes validar aquí (ej: total numérico, items jsonb, etc.)
  const { data, error } = await supabase
    .from("quotes")
    .update(body)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

/** DELETE /api/quotes/:id */
export async function DELETE(_req: Request, { params }: Params) {
  const { error } = await supabase.from("quotes").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
