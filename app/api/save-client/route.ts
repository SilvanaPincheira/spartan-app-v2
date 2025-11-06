import { NextResponse } from "next/server";

// 👉 URL de tu Apps Script para "clientesnuevos"
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxVSyNClFUa-PUPZJnnHtfL6tQH_dG8tE7seMa9TGOMvYbm_kKEyhQJ7faK4zChQT861w/exec";

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          error: "Respuesta de Apps Script no es JSON",
          raw: text,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(json);
  } catch (err: any) {
    console.error("Error en save-client:", err);
    return NextResponse.json(
      {
        error: "Excepción en save-client",
        message: String(err),
      },
      { status: 500 }
    );
  }
}
