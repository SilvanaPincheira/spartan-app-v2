"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

const SHEET_URL =
  "https://script.google.com/macros/s/AKfycbzMsSXb8Bg8zCNTWt1IZppXw5_cO2K1GNwM4YHWpZFB87iSpqYUqSoB-EXpL6GQEN438Q/exec";

interface Row {
  [key: string]: any;
}

export default function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filtered, setFiltered] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // === Cargar historial ===
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`${SHEET_URL}?action=read`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setRows(data);
          setFiltered(data);
        } else {
          console.error("Formato inesperado:", data);
        }
      } catch (err) {
        console.error("Error al cargar historial:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // === Buscar por cliente, rut, ejecutivo o id ===
  useEffect(() => {
    const q = search.toLowerCase();
    if (!q) {
      setFiltered(rows);
      return;
    }
    const f = rows.filter((r) =>
      [
        r["Cliente"],
        r["RUT"],
        r["Ejecutivo"],
        r["ID Evaluación"],
        r["Fecha Evaluación"],
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
    setFiltered(f);
  }, [search, rows]);

  // === Duplicar ===
  async function handleDuplicate(id: string) {
    try {
      const res = await fetch(`${SHEET_URL}?action=read&id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        alert("No se encontró el detalle de esta evaluación.");
        return;
      }

      // Guardar en localStorage y redirigir
      localStorage.setItem("eval.duplicado", JSON.stringify(data));
      window.location.href = "/evaluaciones";
    } catch (err) {
      console.error("Error al duplicar:", err);
      alert("Error al duplicar la evaluación.");
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-40 relative overflow-hidden">
        <div className="absolute inset-0 bg-[#1f4ed8]" />
        <div className="absolute inset-y-0 right-[-20%] w-[60%] rotate-[-8deg] bg-sky-400/60" />
        <div className="relative mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-white uppercase font-semibold tracking-widest text-2xl md:text-3xl">
              Historial Evaluaciones
            </h1>
          </div>
          <Link
            href="/evaluaciones"
            className="rounded bg-white/20 text-white px-3 py-1 text-xs sm:text-sm hover:bg-white/30"
          >
            ⟵ Volver
          </Link>
        </div>
      </header>

      {/* Contenido */}
      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#2B6CFF]">📁 Evaluaciones registradas</h2>
          <input
            className="rounded border px-3 py-1 text-sm"
            placeholder="Buscar por cliente, RUT, ejecutivo o ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="text-sm text-zinc-500">Cargando historial...</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-zinc-500">No hay evaluaciones registradas.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-100">
                <tr>
                  <th className="px-3 py-2 text-left">ID</th>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-left">RUT</th>
                  <th className="px-3 py-2 text-left">Ejecutivo</th>
                  <th className="px-3 py-2 text-right">Venta mensual</th>
                  <th className="px-3 py-2 text-right">Comodato mensual</th>
                  <th className="px-3 py-2 text-center">Estado</th>
                  <th className="px-3 py-2 text-center"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i} className="border-b hover:bg-zinc-50">
                    <td className="px-3 py-2">{r["ID Evaluación"]}</td>
                    <td className="px-3 py-2">{r["Fecha Evaluación"]}</td>
                    <td className="px-3 py-2">{r["Cliente"]}</td>
                    <td className="px-3 py-2">{r["RUT"]}</td>
                    <td className="px-3 py-2">{r["Ejecutivo"]}</td>
                    <td className="px-3 py-2 text-right">{r["Venta Mensual"]}</td>
                    <td className="px-3 py-2 text-right">{r["Comodato Mensual"]}</td>
                    <td
                      className={`px-3 py-2 text-center font-semibold ${
                        r["Estado"] === "Viable"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {r["Estado"]}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleDuplicate(r["ID Evaluación"])}
                        className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
                      >
                        Duplicar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
