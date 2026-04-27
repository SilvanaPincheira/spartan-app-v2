import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN!;

export async function POST(req: Request) {
  try {
    // 🔐 1. Validar token
    const authHeader = req.headers.get("authorization");

    if (!authHeader || authHeader !== `Bearer ${ADMIN_TOKEN}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 📥 2. Leer body
    const { email, newPassword } = await req.json();

    if (!email || !newPassword) {
      return NextResponse.json(
        { error: "Faltan parámetros: email o newPassword" },
        { status: 400 }
      );
    }

    // 🔒 3. Validación básica
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }

    // 👤 4. Buscar usuario
    const { data: users, error: listError } =
      await supabase.auth.admin.listUsers();

    if (listError) throw listError;

    const user = users.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // 🔑 5. Actualizar contraseña
    const { error: updateError } =
      await supabase.auth.admin.updateUserById(user.id, {
        password: newPassword,
      });

    if (updateError) throw updateError;

    // 📝 6. Auditoría (opcional pero recomendado)
    await supabase.from("admin_actions").insert([
      {
        action: "reset_password",
        target_email: email,
        performed_by: "api-admin",
      },
    ]);

    // ✅ 7. Respuesta
    return NextResponse.json({ success: true });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Error interno" },
      { status: 500 }
    );
  }
}