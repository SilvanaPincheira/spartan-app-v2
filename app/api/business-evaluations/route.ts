// app/api/business-evaluations/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/business-evaluations?customer_id=&limit=&page=
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const customer_id = url.searchParams.get("customer_id") ?? "";
    const limit = Math.max(1, Number(url.searchParams.get("limit") ?? 20));
    const page  = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const from = (page - 1) * limit;
    const to   = from + limit - 1;

    let q = supabase.from("business_evaluations")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (customer_id) q = q.eq("customer_id", customer_id);

    const { data, error, count } = await q;
    if (error) throw error;

    return NextResponse.json({ data: data ?? [], count: count ?? 0, error: null });
  } catch (e:any) {
    return NextResponse.json({ data: [], count: 0, error: e.message }, { status: 500 });
  }
}

// POST /api/business-evaluations
// body: { customer_id?, status: 'viable'|'no_viable', comments?, eval_date? (YYYY-MM-DD) }
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // validar status
    if (!body?.status || !['viable','no_viable'].includes(body.status)) {
      return NextResponse.json(
        { data: null, error: "status debe ser 'viable' o 'no_viable'" },
        { status: 400 }
      );
    }

    // si no viene eval_date, usa la fecha de hoy en formato YYYY-MM-DD
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

    const payload = {
      customer_id: body.customer_id ?? null,          // opcional
      status: body.status,                             // enum eval_status
      comments: (body.comments ?? "").toString(),      // texto opcional
      eval_date: (body.eval_date ?? today),            // <- AQUÍ el default
      // puedes añadir más columnas opcionales si quieres
    };

    const { data, error } = await supabase
      .from("business_evaluations")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (e:any) {
    return NextResponse.json({ data: null, error: e.message }, { status: 400 });
  }
}
