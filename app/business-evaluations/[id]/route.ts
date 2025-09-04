// app/api/business-evaluations/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Campos permitidos para PATCH
const ALLOWED_FIELDS = new Set([
  "customer_id",
  "period_months",
  "commission_pct",
  "is_viable",
  "kpis",
  "notes",
]);

// GET /api/business-evaluations/:id
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { data, error } = await supabase
      .from("business_evaluations")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ data: null, error: error.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ data: null, error: "No existe la evaluación" }, { status: 404 });
    }

    return NextResponse.json({ data, error: null });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error GET evaluation" }, { status: 500 });
  }
}

// PATCH /api/business-evaluations/:id
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();

    const update: Record<string, any> = {};
    for (const [k, v] of Object.entries(body ?? {})) {
      if (ALLOWED_FIELDS.has(k)) update[k] = v;
    }

    if (!Object.keys(update).length) {
      return NextResponse.json({ data: null, error: "Nada para actualizar" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("business_evaluations")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ data: null, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data, error: null });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error PATCH evaluation" }, { status: 500 });
  }
}

// DELETE /api/business-evaluations/:id
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { error } = await supabase
      .from("business_evaluations")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ data: null, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: { id, deleted: true }, error: null });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error DELETE evaluation" }, { status: 500 });
  }
}
