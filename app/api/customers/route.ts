export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "";
    let query = supabase.from("customers").select("*").order("created_at", { ascending: false });
    if (q) query = query.ilike("name", `%${q}%`);
    const { data, error } = await query.limit(50);
    if (error) throw error;
    return NextResponse.json({ data, error: null });
  } catch (e: any) {
    return NextResponse.json({ data: [], error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body?.name) return NextResponse.json({ error: "name es obligatorio" }, { status: 400 });

    const payload = {
      rut: body.rut ?? null,
      name: body.name,
      address: body.address ?? null,
      city: body.city ?? null,
      contact_email: body.contact_email ?? null,
      contact_phone: body.contact_phone ?? null
    };

    const { data, error } = await supabase.from("customers").insert([payload]).select().single();
    if (error) throw error;
    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ data: null, error: e.message }, { status: 400 });
  }
}
