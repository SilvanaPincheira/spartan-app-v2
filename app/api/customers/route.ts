// app/api/customers/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  // usa service-role en backend (API) para evitar bloqueos de RLS
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY!
);

// GET /api/customers?search=&limit=20&page=1
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const limit  = Math.max(1, Number(url.searchParams.get("limit") ?? 20));
    const page   = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const from = (page - 1) * limit;
    const to   = from + limit - 1;

    let q = supabase.from("customers").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);

    if (search) {
      q = q.ilike("name", `%${search}%`);
    }

    const { data, error, count } = await q;
    return NextResponse.json({ data, count, error });
  } catch (e:any) {
    return NextResponse.json({ data:null, error: e.message }, { status: 500 });
  }
}

// POST /api/customers
// body: { rut, code, name, address, executive }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const row = {
      rut: (body.rut ?? "").toString().trim(),
      code: (body.code ?? "").toString().trim().toUpperCase(),
      name: (body.name ?? "").toString().trim(),
      address: (body.address ?? "").toString().trim(),
      executive: (body.executive ?? "").toString().trim()
    };

    if (!row.rut || !row.code || !row.name) {
      return NextResponse.json({ data:null, error: "rut, code y name son obligatorios" }, { status: 400 });
    }

    const { data, error } = await supabase.from("customers").insert([row]).select().single();
    return NextResponse.json({ data, error }, { status: error ? 400 : 200 });
  } catch (e:any) {
    return NextResponse.json({ data:null, error: e.message }, { status: 500 });
  }
}

