import { NextResponse } from "next/server";

/**
 * 🔄 Actualiza el estado de un reclamo en Google Sheets a "Respondido"
 * Espera un JSON { id: string }
 */
export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ success: false, error: "Falta el ID del reclamo" }, { status: 400 });
    }

    // URL de tu Apps Script desplegado como Web App (⚠️ revisa que sea la versión implementada)
    const APPSCRIPT_URL =
      "https://script.google.com/macros/s/AKfycbwPlJLaUZLzcM1jBBJBa9gvzQvS8EicsxSaDMDWSkFntiJhMdlnzNkBi40tl7dcJ-zXoA/exec"; // ← reemplázala por tu URL real

    // Llamada al Apps Script con parámetro de acción
    const res = await fetch(`${APPSCRIPT_URL}?action=updateStatus&id=${id}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const json = await res.json();

    if (!json.success) {
      throw new Error(json.error || "No se pudo actualizar el estado");
    }

    return NextResponse.json({ success: true, message: `Reclamo ${id} marcado como Respondido.` });
  } catch (err: any) {
    console.error("❌ Error actualizando estado:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Error al actualizar el estado" },
      { status: 500 }
    );
  }
}
