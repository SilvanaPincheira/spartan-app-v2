export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ==============================================
// GET /api/sales-notes
// ==============================================
export async function GET(req: Request) {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Buscar rol del usuario
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("email", user.email)
      .maybeSingle();

    if (profileError) throw profileError;
    const role = profile?.role ?? "ejecutivo";

    // Query params
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "";
    const customer_id = url.searchParams.get("customer_id") ?? "";
    const fromDate = url.searchParams.get("from");
    const toDate = url.searchParams.get("to");
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.max(
      1,
      Math.min(100, Number(url.searchParams.get("limit") ?? 20))
    );
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let q = supabase
      .from("sales_notes")
      .select("*, sales_note_items(*)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (status) q = q.eq("status", status);
    if (customer_id) q = q.eq("customer_id", customer_id);
    if (fromDate) q = q.gte("note_date", fromDate);
    if (toDate) q = q.lte("note_date", toDate);

    // 🔒 Filtro dinámico según rol
    if (role === "ejecutivo") {
      q = q.eq("created_by", user.email);
    }

    const { data, error, count } = await q;
    if (error) throw error;

    return NextResponse.json({ data, count, error: null });
  } catch (e: any) {
    return NextResponse.json(
      { data: [], count: 0, error: e.message },
      { status: 500 }
    );
  }
}

// ==============================================
// POST /api/sales-notes
// ==============================================
export async function POST(req: Request) {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();

    // Resolver customer_id
    let customerId = body.customer_id ?? null;
    if (!customerId && body.customer_code) {
      const { data: cliente, error: clienteError } = await supabase
        .from("clientes_sap")
        .select("id")
        .eq("card_code", body.customer_code)
        .maybeSingle();

      if (clienteError) throw clienteError;
      if (cliente) customerId = cliente.id;
    }

    if (!customerId) {
      return NextResponse.json(
        { error: "No se pudo obtener el cliente. Selecciona un Código Cliente válido." },
        { status: 400 }
      );
    }

    // Payload con email del creador
    const payload = {
      customer_id: customerId,
      note_date:
        (body.note_date ?? new Date().toISOString().slice(0, 10)) as string,
      subtotal: body.subtotal ?? 0,
      tax: body.tax ?? 0,
      total: body.total ?? 0,
      total_amount: body.total_amount ?? 0,
      status: (body.status ?? "draft") as
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "issued"
        | "cancelled",
      document_number: body.document_number ?? null,
      pdf_url: body.pdf_url ?? null,
      created_by: user.email, // 👈 guardamos el email del usuario
      notes: (body.notes ?? "").toString().trim() || null,
    };

    const { data: note, error: noteError } = await supabase
      .from("sales_notes")
      .insert([payload])
      .select()
      .single();

    if (noteError) throw noteError;

    // Insertar items
    if (body.items && Array.isArray(body.items) && body.items.length > 0) {
      const detalle = body.items.map((it: any) => ({
        sales_note_id: note.id,
        product_code: it.product_code ?? it.code,
        description: it.description ?? it.name,
        qty: it.qty,
        unit_price: it.unit_price ?? it.priceBase,
        discount_pct: it.discount_pct ?? it.descuento ?? 0,
        line_total: it.line_total ?? it.total,
      }));

      const { error: itemsError } = await supabase
        .from("sales_note_items")
        .insert(detalle);

      if (itemsError) throw itemsError;
    }

    return NextResponse.json({ data: note, error: null }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e.message },
      { status: 400 }
    );
  }
}

// ==============================================
// PUT /api/sales-notes?id=...
// ==============================================
export async function PUT(req: Request) {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id es obligatorio" }, { status: 400 });
    }

    const body = await req.json();

    // Verificar propiedad (ejecutivos solo pueden modificar lo suyo)
    const { data: noteOwner } = await supabase
      .from("sales_notes")
      .select("created_by")
      .eq("id", id)
      .maybeSingle();

    if (noteOwner?.created_by !== user.email) {
      // Solo admin/gerencia pueden modificar notas ajenas
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("email", user.email)
        .maybeSingle();

      if (!profile || profile.role === "ejecutivo") {
        return NextResponse.json(
          { error: "No autorizado para modificar esta nota" },
          { status: 403 }
        );
      }
    }

    // Actualizar encabezado
    const { data: updatedNote, error: updateError } = await supabase
      .from("sales_notes")
      .update({
        subtotal: body.subtotal ?? 0,
        tax: body.tax ?? 0,
        total: body.total ?? 0,
        total_amount: body.total_amount ?? 0,
        status: body.status ?? "draft",
        notes: body.notes ?? null,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Reemplazar items
    if (body.items && Array.isArray(body.items)) {
      await supabase.from("sales_note_items").delete().eq("sales_note_id", id);

      if (body.items.length > 0) {
        const detalle = body.items.map((it: any) => ({
          sales_note_id: id,
          product_code: it.product_code ?? it.code,
          description: it.description ?? it.name,
          qty: it.qty,
          unit_price: it.unit_price ?? it.priceBase,
          discount_pct: it.discount_pct ?? it.descuento ?? 0,
          line_total: it.line_total ?? it.total,
        }));

        const { error: itemsError } = await supabase
          .from("sales_note_items")
          .insert(detalle);

        if (itemsError) throw itemsError;
      }
    }

    return NextResponse.json({ data: updatedNote, error: null });
  } catch (e: any) {
    return NextResponse.json(
      { data: null, error: e.message },
      { status: 400 }
    );
  }
}

// ==============================================
// DELETE /api/sales-notes?id=...
// ==============================================
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id es obligatorio" }, { status: 400 });
    }

    await supabase.from("sales_note_items").delete().eq("sales_note_id", id);
    const { error } = await supabase.from("sales_notes").delete().eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 400 }
    );
  }
}

