import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN!;

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader || authHeader !== `Bearer ${ADMIN_TOKEN}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { email, newPassword } = await req.json();

    if (!email || !newPassword) {
      return NextResponse.json(
        { error: "Faltan parámetros" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Contraseña mínimo 8 caracteres" },
        { status: 400 }
      );
    }

    // 🔥 Buscar usuario directamente
    const { data: userData, error: userError } =
      await supabase.auth.admin.getUserByEmail(email);

    if (userError || !userData?.user) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // 🔐 Actualizar contraseña
    const { error } = await supabase.auth.admin.updateUserById(
      userData.user.id,
      { password: newPassword }
    );

    if (error) throw error;

    // 📝 Auditoría
    await supabase.from("admin_actions").insert([
      {
        action: "reset_password",
        target_email: email,
        performed_by: "api-admin",
      },
    ]);

    return NextResponse.json({ success: true });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Error interno" },
      { status: 500 }
    );
  }
}