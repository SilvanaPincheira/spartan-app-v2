// app/api/business-evaluations/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // backend only
);

// GET /api/business-evaluations?customer_id=&status=&limit=20&page=1
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const customer_id = url.searchParams.get("customer_id") ?? "";
    const status = url.searchParams.get("status") ?? ""; // 'viable' | 'no_viable'
    const limit  = Math.max(1, Number(url.searchParams.get("limit") ?? 20));
    const page   = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const from = (page - 1) * limit;
    const to   = from + limit - 1;

    let q = supabase
      .from("business_evaluations")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (customer_id) q = q.eq("customer_id", customer_id);
    if (status)      q = q.eq("status", status);

    const { data, error, count } = await q;
    if (error) throw error;

    return NextResponse.json({ data, count, error: null });
  } catch (e: any) {
    return NextResponse.json({ data: [], count: 0, error: e.message }, { status: 500 });
  }
}

// POST /api/business-evaluations
// body: { customer_id?, status: 'viable'|'no_viable', comments?, eval_date?, months_contract?, avg_monthly_sales?, monthly_lease?, relation_lease_sales?, commission_pct? }
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validación mínima
    if (!body?.status || !["viable", "no_viable"].includes(body.status)) {
      return NextResponse.json(
        { error: "status debe ser 'viable' o 'no_viable'" },
        { status: 400 }
      );
    }

    const payload = {
      customer_id: body.customer_id ?? null,
      status: body.status, // enum eval_status
      comments: (body.comments ?? "").toString(),
      eval_date: body.eval_date ?? null,
      months_contract: body.months_contract ?? null,
      avg_monthly_sales: body.avg_monthly_sales ?? null,
      monthly_lease: body.monthly_lease ?? null,
      relation_lease_sales: body.relation_lease_sales ?? null,
      commission_pct: body.commission_pct ?? null,
      created_by: body.created_by ?? null,
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
