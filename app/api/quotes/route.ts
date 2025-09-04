export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/quotes?customer_id=&limit=&page=
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const customer_id = url.searchParams.get("customer_id") ?? "";
    const limit = Math.max(1, Number(url.searchParams.get("limit") ?? 20));
    const page  = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const from = (page - 1) * limit;
    const to   = from + limit - 1;

    let q = supabase.from("quotes")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (customer_id) q = q.eq("customer_id", customer_id);

    const { data, error, count } = await q;
    if (error) throw error;

    return NextResponse.json({ data, count });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/quotes
// body: { customer_id, total, items, notes?, status? }
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const payload = {
      customer_id: body.customer_id ?? null,
      total: Number(body.total ?? 0),
      items: Array.isArray(body.items) ? body.items : [],
      notes: (body.notes ?? "").toString(),
      status: body.status ?? "draft",
    };

    const { data, error } = await supabase
      .from("quotes")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
