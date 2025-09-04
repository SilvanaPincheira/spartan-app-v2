import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Cliente con la service_role key (seguro en backend, nunca en frontend)
const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// ================== GET ==================
// Leer todas las cotizaciones
export async function GET() {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// ================== POST ==================
// Crear una nueva cotización
export async function POST(req: Request) {
  try {
    const body = await req.json(); // payload enviado desde frontend
    const { cliente_id, total, items } = body;

    const { data, error } = await supabase
      .from("quotes")
      .insert([
        {
          cliente_id,
          total,
          items, // asegúrate que tu columna sea jsonb en la tabla
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

