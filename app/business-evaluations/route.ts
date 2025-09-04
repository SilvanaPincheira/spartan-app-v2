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

    return NextResponse.json({ data, count });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/business-evaluations
// body: { customer_id, evaluation_result: 'viable'|'no_viable', notes? }
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.evaluation_result || !['viable','no_viable'].includes(body.evaluation_result)) {
      return NextResponse.json({ error: "evaluation_result debe ser 'viable' o 'no_viable'" }, { status: 400 });
    }

    const payload = {
      customer_id: body.customer_id ?? null,
      evaluation_result: body.evaluation_result,
      notes: (body.notes ?? "").toString()
    };

    const { data, error } = await supabase.from("business_evaluations").insert([payload]).select().single();
    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
