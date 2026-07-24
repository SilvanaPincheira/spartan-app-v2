import { NextResponse } from "next/server";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyezzTCryZi1tKc8Tr7cJjSQ4FVxvnC6ucC-5wcDa-enUCDhsFT0hZYbXGg03oPTX2x9A/exec";

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    if (!Array.isArray(payload) || payload.length === 0) {
      return NextResponse.json(
        { error: "No se recibieron cotizaciones para guardar" },
        { status: 400 }
      );
    }

    const filaSinNumero = payload.find(
      (fila: any) => !String(fila?.numeroCTZ || "").trim()
    );

    if (filaSinNumero) {
      return NextResponse.json(
        {
          error: "La Cotización no contiene numeroCTZ",
          cliente: filaSinNumero?.cliente || "",
        },
        { status: 400 }
      );
    }

    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tipo: "CTZ",
        datos: payload,
      }),
    });

    const text = await res.text();

    let json: any;

    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          error: "Apps Script devolvió una respuesta inválida.",
          raw: text,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(json);
  } catch (err: any) {
    console.error(err);

    return NextResponse.json(
      {
        error: err.message || "Error guardando Cotización",
      },
      { status: 500 }
    );
  }
}