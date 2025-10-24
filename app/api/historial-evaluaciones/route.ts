export async function POST(req: Request) {
  try {
    const data = await req.json();

    const SCRIPT_URL =
      "https://script.google.com/macros/s/AKfycbzMsSXb8Bg8zCNTWt1IZppXw5_cO2K1GNwM4YHWpZFB87iSpqYUqSoB-EXpL6GQEN438Q/exec";

    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await res.text();

    return new Response(result, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ Error en POST /api/historial-evaluaciones:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal Server Error" }),
      { status: 500 }
    );
  }
}
