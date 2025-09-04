import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Node runtime por defecto (recomendado para empezar)
// export const runtime = 'nodejs';
// Si quisieras Edge: export const runtime = 'edge';  (supabase-js funciona con fetch/Edge, pero mejor empezar en node)

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// GET -> lee
export async function GET() {
  const { data, error } = await supabase
    .from('test_ping')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  return NextResponse.json({ data, error });
}

// POST -> inserta
export async function POST() {
  const { data, error } = await supabase
    .from('test_ping')
    .insert({ msg: 'escribiendo desde la app 🚀' })
    .select()
    .single();

  return NextResponse.json({ data, error });
}
