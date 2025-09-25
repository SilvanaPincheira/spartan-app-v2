import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🚨 Token secreto para proteger la ruta
const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN!;

export async function POST(req: Request) {
  try {
    // Verificar token
    const authHeader = req.headers.get("authorization");
    if (!authHeader || authHeader !== `Bearer ${ADMIN_TOKEN}`) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const { email, newPassword } = await req.json();
    if (!email || !newPassword) {
      return NextResponse.json(
        { error: "Faltan parámetros: email o newPassword" },
        { status: 400 }
      );
    }

    // 1️⃣ Buscar usuario por email
    const { data: users, error: getError } = await supabase.auth.admin.listUsers();
    if (getError) throw getError;

    const user = users.users.find((u: any) => u.email === email);
    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // 2️⃣ Resetear contraseña usando el UID
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });

    if (error) throw error;

    return NextResponse.json({ success: true, user: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

