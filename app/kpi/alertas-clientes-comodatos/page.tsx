export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/comodatos`, { cache: "no-store" });
    const data = (await res.json()).data || [];

    console.log("👉 Total comodatos:", data.length);
    console.log("👉 Ejemplo comodato:", data[0]);

    return NextResponse.json({ total: data.length, ejemplo: data.slice(0, 5) });
  } catch (err) {
    console.error("🔥 Error debug comodatos:", err);
    return NextResponse.json({ error: "Error en debug comodatos" }, { status: 500 });
  }
}
