import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { to, subject, message } = await req.json();

    // 🔎 Normalizar destinatarios
    let recipients: string[] = [];
    if (typeof to === "string" && to.trim() !== "") {
      recipients = [to.trim()];
    } else if (Array.isArray(to)) {
      recipients = to.filter(
        (email) => typeof email === "string" && email.trim() !== ""
      );
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        { success: false, error: "No destinatarios válidos" },
        { status: 400 }
      );
    }

    const data = await resend.emails.send({
      from: "silvana.pincheira@spartan.cl", // 👈 luego puedes cambiar a sac@spartan.cl
      to: recipients, // ✅ aquí ya está limpio
      subject,
      html: `<div style="font-family: sans-serif; font-size: 14px; color: #333;">
              ${message}
            </div>`,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error al enviar correo:", error);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}
