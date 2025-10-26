"use client";

import React, { useState } from "react";

export default function ReclamoRespuestaPage({ params }: { params: { id: string } }) {
  const reclamoId = params.id;
  const [mensaje, setMensaje] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(false);

  async function enviarInforme(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);

    try {
      const formData = new FormData();
      formData.append("id", reclamoId);
      formData.append("mensaje", mensaje);
      if (archivo) formData.append("archivo", archivo);

      const res = await fetch("/api/reclamos/responder", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (json.success) {
        alert("✅ Informe enviado correctamente y reclamo marcado como respondido.");
        setOk(true);
      } else {
        alert("⚠️ Error al enviar: " + (json.error || "Desconocido"));
      }
    } catch (err) {
      console.error(err);
      alert("❌ Error al enviar el informe.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-xl mx-auto bg-white shadow rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-blue-700 mb-4">
          🧾 Informe de Control de Calidad — Reclamo {reclamoId}
        </h1>

        {ok ? (
          <div className="p-4 bg-green-100 text-green-800 rounded-lg text-center">
            ✅ Este reclamo ha sido marcado como <b>respondido</b>.
          </div>
        ) : (
          <form onSubmit={enviarInforme} className="flex flex-col gap-4">
            <label className="flex flex-col">
              <span className="font-medium">Comentario o resumen del informe:</span>
              <textarea
                className="border rounded px-2 py-1"
                rows={4}
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                required
              />
            </label>

            <label className="flex flex-col">
              <span className="font-medium">Adjuntar informe PDF (opcional):</span>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setArchivo(e.target.files?.[0] || null)}
              />
            </label>

            <button
              type="submit"
              disabled={enviando}
              className={`mt-2 py-2 rounded text-white font-semibold ${
                enviando ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {enviando ? "Enviando..." : "📤 Enviar y marcar como respondido"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
