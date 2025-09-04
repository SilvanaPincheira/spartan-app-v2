export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/sales-notes?status=&customer_id=&limit=&page=
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "";
    const customer_id = url.searchParams.get("customer_id") ?? "";
    const limit = Math.max(1, Number(url.searchParams.get("limit") ?? 20));
    const page  = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const from = (page - 1) * limit;
    const to   = from + limit - 1;

    let q = supabase.from("sales_notes")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (status)      q = q.eq("status", status);
    if (customer_id) q = q.eq("customer_id", customer_id);

    const { data, error, count } = await q;
    if (error) throw error;

    return NextResponse.json({ data, count });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/sales-notes
// body: { customer_id, total_amount, notes?, status? }
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const payload = {
      customer_id: body.customer_id ?? null,
      status: body.status ?? "draft",
      total_amount: Number(body.total_amount ?? 0),
      notes: (body.notes ?? "").toString()
    };

    const { data, error } = await supabase.from("sales_notes").insert([payload]).select().single();
    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
