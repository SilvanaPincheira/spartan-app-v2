import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL");
}

if (!serviceRoleKey) {
  throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

async function resetPassword() {
  try {
    const userId = "9e8209cf-79c9-4f93-962a-f77a71d337ed";

    const newPassword = "Spartan123";

    console.log("Intentando cambiar password del UID:", userId);

    const { data, error } =
      await supabase.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

    if (error) {
      console.error("❌ ERROR SUPABASE:");
      console.error(error);
      return;
    }

    console.log("✅ PASSWORD CAMBIADA");
    console.log("Usuario:", data.user.email);
    console.log("UID:", data.user.id);

  } catch (err) {
    console.error("❌ ERROR GENERAL:", err);
  }
}

resetPassword();