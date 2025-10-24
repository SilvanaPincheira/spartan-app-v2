export async function POST(req: Request) {
  try {
    const data = await req.json();

    // URL de tu Apps Script (debe estar publicado como web app con permisos "cualquiera con el enlace")
    const SCRIPT_URL =
      "https://script.google.com/macros/s/AKfycbzMsSXb8Bg8zCNTWt1IZppXw5_cO2K1GNwM4YHWpZFB87iSpqYUqSoB-EXpL6GQEN438Q/exec";

    console.log("📤 Enviando datos al Apps Script...");
    console.log(JSON.stringify(data, null, 2));

    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const text = await res.text();

    // En caso de que Apps Script devuelva texto plano ("OK" o JSON)
    let jsonResponse: any = {};
    try {
      jsonResponse = JSON.parse(text);
    } catch {
      jsonResponse = { success: text.includes("OK"), raw: text };
    }

    console.log("✅ Respuesta Apps Script:", jsonResponse);

    return new Response(JSON.stringify(jsonResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ Error en POST /api/historial-evaluaciones:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
