// app/api/business-evaluations/[id]/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/business-evaluations/:id
export async function GET(_: Request, ctx: { params: { id: string } }) {
  try {
    const { id } = ctx.params;
    const { data, error } = await supabase
      .from("business_evaluations")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return NextResponse.json({ data, error: null });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message }, { status: 404 });
  }
}

// PATCH /api/business-evaluations/:id
// body: { status?, comments?, months_contract?, avg_monthly_sales?, monthly_lease?, relation_lease_sales?, commission_pct?, eval_date? }
export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const { id } = ctx.params;
    const b = await req.json();

    const patch: Record<string, any> = {};
    const allowed = [
      "status",
      "comments",
      "months_contract",
      "avg_monthly_sales",
      "monthly_lease",
      "relation_lease_sales",
      "commission_pct",
      "eval_date",
    ];
    for (const k of allowed) {
      if (k in b) patch[k] = b[k];
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("business_evaluations")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data, error: null });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message }, { status: 400 });
  }
}
