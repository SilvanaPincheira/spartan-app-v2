// app/api/quotes/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Mutaciones seguras del lado servidor
);

// Campos que permitimos actualizar por PATCH
const ALLOWED_FIELDS = new Set([
  "customer_id",
  "rut",
  "customer_name",
  "lines",
  "subtotal",
  "tax",
  "total",
  "currency",
  "status",
  "issued_at",
]);

// GET /api/quotes/:id  -> obtiene UNA cotización
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ data: null, error: error.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ data: null, error: "No existe la cotización" }, { status: 404 });
    }

    return NextResponse.json({ data, error: null });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error GET quote" }, { status: 500 });
  }
}

// PATCH /api/quotes/:id  -> actualiza parcialmente
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();

    // Filtrado de campos permitidos
    const update: Record<string, any> = {};
    for (const [k, v] of Object.entries(body ?? {})) {
      if (ALLOWED_FIELDS.has(k)) update[k] = v;
    }
    // Timestamp de actualización
    update.updated_at = new Date().toISOString();

    if (Object.keys(update).length === 1 && "updated_at" in update) {
      return NextResponse.json({ data: null, error: "Nada para actualizar" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("quotes")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ data: null, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data, error: null });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error PATCH quote" }, { status: 500 });
  }
}

// DELETE /api/quotes/:id  -> elimina la cotización
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { error } = await supabase
      .from("quotes")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ data: null, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: { id, deleted: true }, error: null });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e?.message ?? "Error DELETE quote" }, { status: 500 });
  }
}
