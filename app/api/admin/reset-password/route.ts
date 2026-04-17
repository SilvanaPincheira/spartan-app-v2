import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,              // 🔒 URL privada
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // 🔒 service role
);

// 🚨 Token secreto para proteger la ruta
const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN!;

export async function POST(req: Request) {
  try {
    // 1️⃣ Verificar token
    const authHeader = req.headers.get("authorization");
    if (!authHeader || authHeader !== `Bearer ${ADMIN_TOKEN}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 2️⃣ Leer parámetros
    const { email, newPassword } = await req.json();
    if (!email || !newPassword) {
      return NextResponse.json(
        { error: "Faltan parámetros: email o newPassword" },
        { status: 400 }
      );
    }

    // 3️⃣ Buscar usuario (list + find)
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    const user = users?.users.find((u) => u.email === email);
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // 4️⃣ Resetear contraseña usando UID
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });
    if (error) throw error;

    // 5️⃣ Registrar en tabla de auditoría
    await supabase.from("admin_actions").insert([
      {
        action: "reset_password",
        target_email: email,
        performed_by: "api-admin",
      },
    ]);

    return NextResponse.json({ success: true, user: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
