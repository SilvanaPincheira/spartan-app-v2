"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* === Tipos === */
interface Reclamo {
  id: string;
  fecha: string;
  ejecutivo: string;
  cliente: string;
  correo: string;
  rut: string;
  producto: string;
  descripcion: string;
}

/* === Página === */
export default function ReclamoDetallePage() {
  const { id } = useParams();
  const [reclamo, setReclamo] = useState<Reclamo | null>(null);
  const [loading, setLoading] = useState(true);

  // Campos del informe de control
  const [acciones, setAcciones] = useState("");
  const [causa, setCausa] = useState("");
  const [responsable, setResponsable] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  const supabase = createClientComponentClient();

  /* === Cargar reclamo desde la hoja Google === */
  useEffect(() => {
    async function loadReclamo() {
      try {
        const SHEET_URL =
          "https://docs.google.com/spreadsheets/d/1Te8xrWiWSvLl_YwqgK55rHw6eBGHeVeMGi0Z1G2ft4E/export?format=csv&gid=REEMPLAZAR_GID_RECLAMOS";
        const res = await fetch(SHEET_URL);
        const text = await res.text();
        const rows = text.trim().split("\n").map((r) => r.split(","));
        const headers = rows[0];
        const data = rows.slice(1).map((r) =>
          Object.fromEntries(headers.map((h, i) => [h.trim(), r[i] ?? ""]))
        );

        const found = data.find((r) => String(r["0"]) === id);
        if (found) {
          setReclamo({
            id,
            fecha: found["Fecha envío"],
            ejecutivo: found["Ejecutivo de ventas"],
            cliente: found["Cliente"],
            correo: found["Correo de contacto"],
            rut: found["Rut empresa"],
            producto: found["Producto"],
            descripcion: found["DESCRIPCIÓN DEL PROBLEMA"],
          });
        }
      } catch (err) {
        console.error("❌ Error cargando reclamo:", err);
      } finally {
        setLoading(false);
      }
    }

    if (id) loadReclamo();
  }, [id]);

  /* === Enviar informe de control === */
  async function enviarInforme() {
    if (!reclamo) return;
    if (!acciones || !causa || !responsable) {
      alert("Completa todos los campos del informe antes de enviar.");
      return;
    }

    try {
      setEnviando(true);

      // Convertir archivo adjunto a Base64
      let adjuntoBase64 = "";
      if (archivo) {
        const reader = new FileReader();
        adjuntoBase64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(archivo);
        });
      }

      const html = `
        <p>Estimado/a <b>${reclamo.ejecutivo}</b>,</p>
        <p>Se ha completado el <b>Informe de Control de Calidad</b> para tu reclamo N° ${reclamo.id}.</p>
        <ul>
          <li><b>Cliente:</b> ${reclamo.cliente}</li>
          <li><b>Producto:</b> ${reclamo.producto}</li>
          <li><b>Descripción:</b> ${reclamo.descripcion}</li>
        </ul>
        <h3>Resultado del Informe</h3>
        <p><b>Causa raíz:</b> ${causa}</p>
        <p><b>Acciones correctivas:</b> ${acciones}</p>
        <p><b>Responsable:</b> ${responsable}</p>
        <p>Se adjunta el informe de control en PDF.</p>
      `;

      // Enviar correo vía tu API
      const res = await fetch("/api/send-reclamo-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: reclamo.correo,
          subject: `Informe de Control Reclamo N° ${reclamo.id} — ${reclamo.cliente}`,
          html,
          attachments: archivo
            ? [
                {
                  filename: archivo.name,
                  content: `data:${archivo.type};base64,${adjuntoBase64}`,
                },
              ]
            : [],
        }),
      });

      const result = await res.json();
      if (!result.ok) throw new Error(result.error || "Error al enviar informe");

      alert("✅ Informe de control enviado correctamente al ejecutivo.");
      setAcciones("");
      setCausa("");
      setResponsable("");
      setArchivo(null);
    } catch (err) {
      console.error("❌ Error al enviar:", err);
      alert("No se pudo enviar el informe. Revisa la consola.");
    } finally {
      setEnviando(false);
    }
  }

  /* === UI === */
  if (loading) return <div className="p-6 text-zinc-500">Cargando reclamo...</div>;
  if (!reclamo) return <div className="p-6 text-red-600">Reclamo no encontrado.</div>;

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6">
      <h1 className="text-2xl font-bold text-[#1f4ed8] mb-4">
        🧾 Informe de Control — Reclamo #{id}
      </h1>

      <div className="bg-zinc-50 p-4 rounded-lg border mb-4 text-sm">
        <p><b>Fecha:</b> {reclamo.fecha}</p>
        <p><b>Ejecutivo:</b> {reclamo.ejecutivo}</p>
        <p><b>Cliente:</b> {reclamo.cliente}</p>
        <p><b>Producto:</b> {reclamo.producto}</p>
        <p><b>Descripción:</b> {reclamo.descripcion}</p>
      </div>

      <h2 className="text-lg font-semibold mb-2">Informe de Control de Calidad</h2>
      <div className="space-y-3 text-sm">
        <label className="block">
          <span className="font-medium">Causa raíz del problema</span>
          <textarea
            value={causa}
            onChange={(e) => setCausa(e.target.value)}
            className="w-full border rounded px-2 py-1 mt-1"
            rows={3}
          />
        </label>

        <label className="block">
          <span className="font-medium">Acciones correctivas / preventivas</span>
          <textarea
            value={acciones}
            onChange={(e) => setAcciones(e.target.value)}
            className="w-full border rounded px-2 py-1 mt-1"
            rows={3}
          />
        </label>

        <label className="block">
          <span className="font-medium">Responsable</span>
          <input
            value={responsable}
            onChange={(e) => setResponsable(e.target.value)}
            className="w-full border rounded px-2 py-1 mt-1"
          />
        </label>

        <label className="block">
          <span className="font-medium">Adjuntar informe (PDF)</span>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setArchivo(e.target.files?.[0] || null)}
            className="mt-1 text-xs"
          />
        </label>

        <button
          onClick={enviarInforme}
          disabled={enviando}
          className={`mt-4 w-full rounded px-3 py-2 text-white font-medium ${
            enviando ? "bg-zinc-400" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {enviando ? "Enviando..." : "📤 Enviar Informe al Ejecutivo"}
        </button>
      </div>
    </div>
  );
}
