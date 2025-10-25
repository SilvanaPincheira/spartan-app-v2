"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* === TIPOS === */
type Row = {
  ["ID Evaluación"]: string;
  ["Fecha Evaluación"]: string;
  ["Cliente"]: string;
  ["Ejecutivo"]: string;
  ["Correo Ejecutivo"]: string;
  ["Venta Mensual ($)"]: number;
  ["Comodato Mensual ($)"]: number;
  ["Estado"]: string;
  [key: string]: any;
};

/* === FORMATEADORES === */
function money(n: number) {
  if (!Number.isFinite(n)) n = 0;
  return n.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

/* === LECTOR DE GViz === */
async function fetchGVizRows(sheetUrl: string) {
  const m = sheetUrl.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const id = m ? m[1] : "";
  const g = sheetUrl.match(/[?&#]gid=([0-9]+)/);
  const gid = g ? g[1] : "0";
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&gid=${gid}`;
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  const headers: string[] = json.table.cols.map((c: any) => (c.label || c.id || "").trim());

  const rows = json.table.rows.map((r: any) => {
    const obj: Record<string, any> = {};
    headers.forEach((h, i) => (obj[h] = r.c[i]?.v ?? r.c[i]?.f ?? ""));
    return obj;
  });

  return rows as Row[];
}

/* === COMPONENTE PRINCIPAL === */
export default function HistorialEvaluaciones() {
  const [evaluaciones, setEvaluaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");

  const supabase = createClientComponentClient();

  /* === OBTENER USUARIO LOGUEADO === */
  useEffect(() => {
    async function getUser() {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        const email = data.user.email || "";
        const name =
          data.user.user_metadata?.nombre ||
          data.user.user_metadata?.full_name ||
          email.split("@")[0];

        setUserEmail(email);
        setUserName(name);
      }
    }
    getUser();
  }, []);

  /* === CARGAR HOJA Y FILTRAR POR CORREO === */
  useEffect(() => {
    if (!userEmail) return; // Esperar a tener login activo

    async function cargarDatos() {
      try {
        const SHEET_URL =
          "https://docs.google.com/spreadsheets/d/1Te8xrWiWSvLl_YwqgK55rHw6eBGHeVeMGi0Z1G2ft4E/edit?gid=1798666527#gid=1798666527";
        const data = await fetchGVizRows(SHEET_URL);

        // ✅ Filtro por correo
        const esAdmin =
          userEmail.toLowerCase().includes("@spartan.cl") &&
          (userEmail.includes("admin") || userEmail.includes("gerencia"));

        const dataFiltrada = esAdmin
          ? data
          : data.filter(
              (r) =>
                (r["Correo Ejecutivo"] || "").trim().toLowerCase() ===
                userEmail.trim().toLowerCase()
            );

        // 🧩 Agrupar por ID Evaluación
        const agrupado = Object.values(
          dataFiltrada.reduce((acc: any, row: Row) => {
            const id = row["ID Evaluación"];
            if (!id || id === "ID Evaluación") return acc;
            if (!acc[id]) {
              acc[id] = {
                id,
                fecha: String(row["Fecha Evaluación"] || "").replace(/^"|"$/g, ""),
                cliente: row["Cliente"] || "",
                ejecutivo: row["Ejecutivo"] || "",
                correo: row["Correo Ejecutivo"] || "",
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
  }, [userEmail]);

  /* === DUPLICAR === */
  function duplicarEvaluacion(evalItem: any) {
    if (!evalItem?.filas?.length) {
      alert("No hay datos para duplicar esta evaluación.");
      return;
    }
    localStorage.setItem("eval.duplicado", JSON.stringify(evalItem.filas));
    window.location.href = "/comodatos/negocios";
  }

  /* === RENDER === */
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
        <div className="text-center text-zinc-500 py-10">
          Cargando historial...
        </div>
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
                <th className="px-3 py-2 text-left">Correo Ejecutivo</th>
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
                  <td className="px-3 py-2">{r.correo}</td>
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
