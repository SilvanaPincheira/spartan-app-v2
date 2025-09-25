// app/api/business-evaluations/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const preferredRegion = "auto";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);


// GET /api/business-evaluations
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const customer_id = url.searchParams.get("customer_id") ?? "";
    const status = url.searchParams.get("status") ?? "";
    const fromDate = url.searchParams.get("from");
    const toDate = url.searchParams.get("to");
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? 20)));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let q = supabase
      .from("business_evaluations")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (customer_id) q = q.eq("customer_id", customer_id);
    if (status) q = q.eq("status", status);
    if (fromDate) q = q.gte("eval_date", fromDate);
    if (toDate) q = q.lte("eval_date", toDate);

    const { data, error, count } = await q;
    if (error) throw error;

    return NextResponse.json({ data, count, error: null });
  } catch (e: any) {
    return NextResponse.json({ data: [], count: 0, error: e.message }, { status: 500 });
  }
}

// POST /api/business-evaluations
export async function POST(req: Request) {
  try {
    const b = await req.json();

    if (!b.eval_date) {
      return NextResponse.json({ error: "eval_date es obligatorio (YYYY-MM-DD)" }, { status: 400 });
    }
    if (!b.months_contract && b.months_contract !== 0) {
      return NextResponse.json({ error: "months_contract es obligatorio" }, { status: 400 });
    }
    if (!["viable", "no_viable"].includes(b.status ?? "")) {
      return NextResponse.json({ error: "status debe ser 'viable' o 'no_viable'" }, { status: 400 });
    }

    const payload = {
      customer_id: b.customer_id ?? null,
      eval_date: b.eval_date,
      months_contract: Number(b.months_contract),
      avg_monthly_sales: b.avg_monthly_sales ?? 0,
      monthly_lease: b.monthly_lease ?? 0,
      relation_lease_sales: b.relation_lease_sales ?? 0,
      commission_pct: b.commission_pct ?? 0,
      status: b.status,
      comments: (b.comments ?? "").toString().trim() || null,
      created_by: b.created_by ?? null,
    };

    const { data, error } = await supabase
      .from("business_evaluations")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message }, { status: 400 });
  }
}
