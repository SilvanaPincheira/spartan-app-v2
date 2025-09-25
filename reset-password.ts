import { createClient } from "@supabase/supabase-js";

// ⚠️ Usa las variables de entorno de tu proyecto
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://beepxealdpjbxtivugwv.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZXB4ZWFsZHBqYnh0aXZ1Z3d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzIzMDksImV4cCI6MjA3MjQ0ODMwOX0.QARAnpPD2fyuJrDXaLZWFflAyZsIRS8KBX_D4LpMclQ"
);

async function resetPassword() {
  try {
    // 👇 Reemplaza con el UID del usuario (lo ves en la consola de Auth > Users)
    const userId = "3b2b2ab8-a5a5-44b5-8ed9-5796260ce15c";

    // 👇 Nueva clave (puedes cambiarla)
    const newPassword = "Spartan123";

    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      console.error("❌ Error reseteando contraseña:", error.message);
    } else {
      console.log("✅ Contraseña actualizada con éxito para:", data.user.email);
    }
  } catch (err: any) {
    console.error("Error general:", err.message);
  }
}

resetPassword();
