"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

type Row = {
  ["ID Evaluación"]: string;
  ["Fecha Evaluación"]: string;
  ["Cliente"]: string;
  ["Ejecutivo"]: string;
  ["Venta Mensual ($)"]: string;
  ["Comodato Mensual ($)"]: string;
  ["Estado"]: string;
  [key: string]: any;
};

export default function HistorialEvaluaciones() {
  const [evaluaciones, setEvaluaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargarDatos() {
      try {
        const SHEET_ID = "1Te8xrWiWSvLl_YwqgK55rHw6eBGHeVeMGi0Z1G2ft4E";
        const GID = "1798666527";
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
        const res = await fetch(url);
        const text = await res.text();

        const [headerLine, ...rows] = text.trim().split("\n");
        const headers = headerLine.split(",").map((h) => h.trim());
        const data: Row[] = rows.map((line) => {
          const cols = line.split(",");
          const obj: any = {};
          headers.forEach((h, i) => (obj[h] = cols[i] ?? ""));
          return obj;
        });

        // agrupar por ID Evaluación
        const agrupado = Object.values(
          data.reduce((acc: any, row: Row) => {
            const id = row["ID Evaluación"];
            if (!id || id === "ID Evaluación") return acc;
            if (!acc[id]) {
              acc[id] = {
                id,
                fecha: row["Fecha Evaluación"] || "",
                cliente: row["Cliente"] || "",
                ejecutivo: row["Ejecutivo"] || "",
                venta: Number(row["Venta Mensual ($)"] || 0),
                comodato: Number(row["Comodato Mensual ($)"] || 0),
                estado: row["Estado"] || "",
                filas: [],
              };
            }
            acc[id].filas.push(row);
            return acc;
          }, {})
        );

        setEvaluaciones(agrupado);
      } catch (err) {
        console.error("❌ Error cargando hoja:", err);
      } finally {
        setLoading(false);
      }
    }

    cargarDatos();
  }, []);

  function money(n: number) {
    return n.toLocaleString("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    });
  }

  function duplicarEvaluacion(evalItem: any) {
    if (!evalItem?.filas?.length) {
      alert("No hay datos para duplicar esta evaluación.");
      return;
    }
    localStorage.setItem("eval.duplicado", JSON.stringify(evalItem.filas));
    window.location.href = "/comodatos/evaluaciones"; // 🔁 vuelve al formulario principal
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#1f4ed8] flex items-center gap-2">
          <span>🗂️</span> Historial de Evaluaciones
        </h1>
        <Link
          href="/comodatos/evaluaciones"
          className="rounded bg-zinc-200 px-3 py-2 text-sm hover:bg-zinc-300"
        >
          ⟵ Volver a Evaluación
        </Link>
      </div>

      {loading ? (
        <div className="text-center text-zinc-500 py-10">Cargando historial...</div>
      ) : evaluaciones.length === 0 ? (
        <div className="text-center text-zinc-500 py-10">
          No hay evaluaciones registradas aún.
        </div>
      ) : (
        <div className="rounded-2xl border bg-white shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100">
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
              {evaluaciones.map((r: any) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{r.id}</td>
                  <td className="px-3 py-2">{r.fecha}</td>
                  <td className="px-3 py-2">{r.cliente}</td>
                  <td className="px-3 py-2">{r.ejecutivo}</td>
                  <td className="px-3 py-2 text-right">{money(r.venta)}</td>
                  <td className="px-3 py-2 text-right">{money(r.comodato)}</td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                        r.estado === "Viable"
                          ? "bg-green-200 text-green-700"
                          : "bg-red-200 text-red-700"
                      }`}
                    >
                      {r.estado === "Viable" ? "✓" : "✗"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => duplicarEvaluacion(r)}
                      className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
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
    </div>
  );
}
