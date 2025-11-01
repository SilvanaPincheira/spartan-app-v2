"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ✅ Parser robusto para CSV con comillas o comas
function parseCSV(text: string) {
  const rows = text.trim().split(/\r?\n/);
  return rows.map((row) => {
    const matches = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    return matches ? matches.map((v) => v.replace(/^"|"$/g, "")) : [];
  });
}

export default function MetasPage() {
  const supabase = createClientComponentClient();
  const [perfil, setPerfil] = useState<any>(null);
  const [dataGlobal, setDataGlobal] = useState<any[]>([]);
  const [dataEjecutivos, setDataEjecutivos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const SHEET_METAS =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vS6eHEKLPnnwmtrSFaNvShM3zjdoJ7kr7gmaq6qK1giAXgBm4xulZ1ChS460ejlFUCfabxTect725wf/pub?gid=0&single=true&output=csv";
  const SHEET_VENTAS =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQXztj-EM_OgRPoKxjRiMleVhH0QVWzG7RSpGIwqMXjUwc_9ENeOYeV9VIcoTpN45vAF3HGZlWl7f4Q/pub?gid=0&single=true&output=csv";

  useEffect(() => {
    async function cargarDatos() {
      setLoading(true);

      // === Perfil del usuario ===
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      let filtroGerencia = "";

      if (user) {
        const { data: perfilData } = await supabase
          .from("profiles")
          .select("department, display_name, role")
          .eq("id", user.id)
          .single();

        setPerfil(perfilData);

        if (perfilData?.department === "gerencia_food") filtroGerencia = "F&B";
        else if (perfilData?.department === "gerencia_hc") filtroGerencia = "HC";
        else if (perfilData?.department === "gerencia_ind") filtroGerencia = "IND";
      }

      // === Leer hojas ===
      const [metasText, ventasText] = await Promise.all([
        fetch(SHEET_METAS).then((r) => r.text()),
        fetch(SHEET_VENTAS).then((r) => r.text()),
      ]);

      const metasRows = parseCSV(metasText);
      const ventasRows = parseCSV(ventasText);

      const meses = metasRows[0].slice(2); // columnas desde Enero
      const metas = metasRows.slice(1).filter((r) => r[0]);
      const ventas = ventasRows.slice(1).filter((r) => r[0]);

      // === Filtrar por gerencia ===
      const metasFiltradas = metas.filter((r) =>
        filtroGerencia ? r[0].toUpperCase().includes(filtroGerencia) : true
      );
      const ventasFiltradas = ventas.filter((r) =>
        filtroGerencia ? r[0].toUpperCase().includes(filtroGerencia) : true
      );

      // === Agrupar metas y ventas por ejecutivo ===
      const ejecutivos = Array.from(
        new Set(metasFiltradas.map((r) => r[1]?.trim()))
      );

      const dataEjecutivosCalc = ejecutivos.map((ej) => {
        const filaMeta = metasFiltradas.find((r) => r[1]?.trim() === ej);
        const filaVenta = ventasFiltradas.find((r) => r[1]?.trim() === ej);
        const obj: any = { ejecutivo: ej };

        meses.forEach((mes, i) => {
            const meta = parseFloat(
                String(filaMeta?.[i + 2] || "0").replace(/\./g, "").replace(",", ".")
              ) || 0;
              
              const venta = parseFloat(
                String(filaVenta?.[i + 2] || "0").replace(/\./g, "").replace(",", ".")
              ) || 0;
               
          obj[mes] = { meta, venta, cumplimiento: meta > 0 ? Math.round((venta / meta) * 100) : 0 };
        });
        return obj;
      });

      // === Agrupar totales globales ===
      const dataGlobalCalc = meses.map((mes, i) => {
        let totalMeta = 0;
        let totalVenta = 0;
        dataEjecutivosCalc.forEach((ej) => {
          totalMeta += ej[mes].meta;
          totalVenta += ej[mes].venta;
        });
        return {
          mes,
          meta: Math.round(totalMeta),
          venta: Math.round(totalVenta),
          cumplimiento:
            totalMeta > 0 ? Math.round((totalVenta / totalMeta) * 100) : 0,
        };
      });

      setDataEjecutivos(dataEjecutivosCalc);
      setDataGlobal(dataGlobalCalc);
      setLoading(false);
    }

    cargarDatos();
  }, []);

  if (loading)
    return <p className="p-8 text-gray-500">Cargando datos de metas...</p>;

  const totalMeta = dataGlobal.reduce((a, b) => a + b.meta, 0);
  const totalVenta = dataGlobal.reduce((a, b) => a + b.venta, 0);
  const cumplimientoTotal =
    totalMeta > 0 ? Math.round((totalVenta / totalMeta) * 100) : 0;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-900 mb-1">
        Cumplimiento de Metas 2025
      </h1>
      {perfil && (
        <p className="text-gray-600 mb-6">
          Gerencia:{" "}
          <strong>{perfil.department?.replace("gerencia_", "").toUpperCase()}</strong>{" "}
          — {perfil.display_name}
        </p>
      )}

      {/* === KPIs generales === */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border rounded-2xl shadow-sm p-5">
          <h3 className="text-gray-600 text-sm">Meta Total Anual</h3>
          <p className="text-2xl font-bold text-blue-800">
            {totalMeta.toLocaleString("es-CL")}
          </p>
        </div>
        <div className="bg-white border rounded-2xl shadow-sm p-5">
          <h3 className="text-gray-600 text-sm">Venta Total Anual</h3>
          <p className="text-2xl font-bold text-green-700">
            {totalVenta.toLocaleString("es-CL")}
          </p>
        </div>
        <div className="bg-white border rounded-2xl shadow-sm p-5">
          <h3 className="text-gray-600 text-sm">% Cumplimiento</h3>
          <p
            className={`text-2xl font-bold ${
              cumplimientoTotal >= 100
                ? "text-green-600"
                : cumplimientoTotal >= 80
                ? "text-yellow-600"
                : "text-red-600"
            }`}
          >
            {cumplimientoTotal}%
          </p>
        </div>
      </div>

      {/* === Gráfico de tendencia === */}
      <div className="bg-white border rounded-2xl shadow-sm p-6 mb-10">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          Tendencia Meta vs Venta (Total Gerencia)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={dataGlobal}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="mes" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="meta"
              stroke="#1f4ed8"
              strokeWidth={3}
              name="Meta"
            />
            <Line
              type="monotone"
              dataKey="venta"
              stroke="#16a34a"
              strokeWidth={3}
              name="Venta"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* === Tabla por ejecutivo (mes actual: Octubre por ejemplo) === */}
      <div className="bg-white border rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          Cumplimiento de Ejecutivos — Octubre
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 border-b">
                <th className="py-2 px-3 text-left">Ejecutivo</th>
                <th className="py-2 px-3 text-right">Meta</th>
                <th className="py-2 px-3 text-right">Venta</th>
                <th className="py-2 px-3 text-right">% Cumplimiento</th>
              </tr>
            </thead>
            <tbody>
              {dataEjecutivos.map((ej, i) => {
                const mes = "Octubre"; // 👈 aquí puedes automatizar el mes actual
                const meta = ej[mes]?.meta || 0;
                const venta = ej[mes]?.venta || 0;
                const cumplimiento = ej[mes]?.cumplimiento || 0;
                return (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium text-gray-800">
                      {ej.ejecutivo}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-700">
                      {meta.toLocaleString("es-CL")}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-700">
                      {venta.toLocaleString("es-CL")}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-semibold ${
                        cumplimiento >= 100
                          ? "text-green-600"
                          : cumplimiento >= 80
                          ? "text-yellow-600"
                          : "text-red-600"
                      }`}
                    >
                      {cumplimiento}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

