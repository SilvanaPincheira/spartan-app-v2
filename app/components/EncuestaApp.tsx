"use client";

import { useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function EncuestaApp() {
  const supabase = createClientComponentClient();
  const [rating, setRating] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return alert("Selecciona una puntuación.");

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("encuesta_app").insert([
      {
        user_id: user?.id || null,
        rating,
        comentario,
      },
    ]);

    if (error) console.error(error);
    else setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="p-4 rounded-2xl shadow bg-green-50 text-center">
        <p className="font-semibold text-green-700">
          ✅ ¡Gracias por tu opinión sobre SpartanOne!
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl shadow p-4 max-w-md mx-auto mt-6"
    >
      <h2 className="text-lg font-semibold mb-3 text-center">
        ¿Qué tan satisfecho estás con SpartanOne?
      </h2>

      <div className="flex justify-center space-x-2 mb-4">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className={`text-2xl ${
              n <= (rating || 0) ? "text-yellow-400" : "text-gray-300"
            }`}
          >
            ★
          </button>
        ))}
      </div>

      <textarea
        placeholder="¿Qué podríamos mejorar?"
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        className="w-full border rounded-md p-2 mb-3 text-sm"
        rows={3}
      />

      <button
        type="submit"
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md"
      >
        Enviar opinión
      </button>
    </form>
  );
}
