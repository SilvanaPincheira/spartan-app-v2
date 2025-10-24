"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

/* === Helper para leer CSV === */
function parseCsv(text: string) {
  const rows = text.trim().split("\n").map((r) => r.split(","));
  const headers = rows.shift() || [];
  return rows.map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h.trim()] = (r[i] || "").trim()));
    return obj;
  });
}

async function loadSheetCsv(spreadsheetId: string, gid = "0") {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar el Sheet.");
  const text = await res.text();
  return parseCsv(text);
}

export default function Page() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sheetUrl =
    "https://docs.google.com/spreadsheets/d/1UXVAxwzg-Kh7AWCPnPbxbEpzXnRPR2pDBKrRUFNZKZo/edit?gid=0";

  useEffect(() => {
    (async () => {
      try {
        const match = sheetUrl.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        const id = match ? match[1] : "";
        const gidMatch = sheetUrl.match(/[?&#]gid=([0-9]+)/);
        const gid = gidMatch ? gidMatch[1] : "0";

        const rows = await loadSheetCsv(id, gid);
        setData(rows);
      } catch (err) {
        console.error(err);
        setError("Error al cargar el historial.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function handleDuplicar(idEval: string) {
    const seleccion = data.filter((r) => r["ID Evaluación"] === idEval);
    if (!seleccion.length) return alert("No se encontró la evaluación seleccionada.");

    localStorage.setItem("eval.duplicado", JSON.stringify(seleccion));
    alert(`✅ Evaluación ${idEval} cargada. Serás redirigido al formulario.`);
    window.location.href = "/comodatos/negocios";
  }

  if (loading) return <div className="p-6 text-sm text-zinc-600">Cargando historial...</div>;
  if (error) return <div className="p-6 text-sm text-red-600">{error}</div>;

  // Mostrar sólo la cabecera de cada evaluación (una por ID)
  const unicos = Array.from(
    new Map(data.map((r) => [r["ID Evaluación"], r])).values()
  );

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1f4ed8]">
          📋 Historial de Evaluaciones
        </h1>
        <Link
          href="/comodatos/negocios"
          className="rounded bg-zinc-200 px-3 py-1 text-sm hover:bg-zinc-300"
        >
          ⟵ Volver a Evaluación
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-100 text-zinc-700">
            <tr>
              <th className="px-3 py-2 text-left">ID Evaluación</th>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Cliente</th>
              <th className="px-3 py-2 text-left">Ejecutivo</th>
              <th className="px-3 py-2 text-right">Venta Mensual</th>
              <th className="px-3 py-2 text-right">Comodato Mensual</th>
              <th className="px-3 py-2 text-center">Estado</th>
              <th className="px-3 py-2 text-center">Acción</th>
            </tr>
          </thead>
          <tbody>
            {unicos.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-zinc-500">
                  No hay evaluaciones guardadas.
                </td>
              </tr>
            ) : (
              unicos.map((r, i) => (
                <tr key={i} className="border-b hover:bg-zinc-50">
                  <td className="px-3 py-2">{r["ID Evaluación"] || "-"}</td>
                  <td className="px-3 py-2">{r["Fecha Evaluación"] || "-"}</td>
                  <td className="px-3 py-2">{r["Cliente"] || "-"}</td>
                  <td className="px-3 py-2">{r["Ejecutivo"] || "-"}</td>
                  <td className="px-3 py-2 text-right">
                    {Number(r["Venta Mensual ($)"] || 0).toLocaleString("es-CL", {
                      style: "currency",
                      currency: "CLP",
                      maximumFractionDigits: 0,
                    })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {Number(r["Comodato Mensual ($)"] || 0).toLocaleString("es-CL", {
                      style: "currency",
                      currency: "CLP",
                      maximumFractionDigits: 0,
                    })}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        r["Estado"] === "Viable"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {r["Estado"] || "-"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => handleDuplicar(r["ID Evaluación"])}
                      className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
                    >
                      Duplicar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
