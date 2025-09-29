import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { to, subject, message } = await req.json();

    const data = await resend.emails.send({
      from: "silvana.pincheira@spartan.cl", // 👈 luego cambiaremos a sac@spartan.cl
      to: to,
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
