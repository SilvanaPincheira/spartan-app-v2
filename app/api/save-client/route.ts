import { NextResponse } from "next/server";

// 👉 URL de tu Apps Script para "clientesnuevos"
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycby9PfS3jthwn1TdLyYcSFEElALPZOV_FIX7cTVWF7tI8e9-9_GhaDHA-SicZjeOkkcOaQ/exec";

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
