// app/api/ping-db/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Si prefieres Node por defecto (recomendado)
export const runtime = 'nodejs';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY! // con tus políticas RLS que permiten read/insert
);

// GET -> lee últimos registros
export async function GET() {
  const { data, error } = await supabase
    .from('test_ping')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  // estandariza claves a español
  return NextResponse.json({
    datos: data ?? [],
    error: error ? { message: error.message } : null,
  });
}

// POST -> inserta un registro { msg }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const msg: string | undefined = body?.msg;

    if (!msg || typeof msg !== 'string' || !msg.trim()) {
      return NextResponse.json(
        { error: 'Falta el campo "msg" (string)' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('test_ping')
      .insert({ msg })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, fila: data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Error procesando JSON' },
      { status: 400 }
    );
  }
}
