"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* === UTILIDADES === */
function clean(value: any) {
  return String(value || "")
    .trim()
    .replace(/\r|\n/g, "")
    .replace(/\s+/g, " ");
}

// === Parser robusto de CSV ===
function parseCSV(text: string) {
  const rows = text.trim().split(/\r?\n/);
  return rows.map((row) => {
    const matches = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    return matches ? matches.map((v) => v.replace(/^"|"$/g, "")) : [];
  });
}

// === Normalizador robusto ===
function normalizarFilas(rows: string[][]): string[][] {
  return rows
    .slice(1)
    .map((r) => {
      if (!r) return null;

      const gerencia = clean(r[0] || "");

      // Encuentra primera celda numérica (inicio de los datos)
      const idxInicioDatos = r.findIndex((v) =>
        /^\d/.test(v.replace(/\./g, "").replace(",", ".").trim())
      );

      if (idxInicioDatos === -1) return null;

      // Reconstruye nombre completo
      const nombre = r
        .slice(1, idxInicioDatos)
        .join(" ")
        .replace(/\s{2,}/g, " ")
        .trim()
        .toUpperCase();

      const valores = r
        .slice(idxInicioDatos)
        .map((v) => clean(v).replace(/\./g, "").replace(",", "."));

      return [gerencia, nombre, ...valores];
    })
    .filter((r): r is string[] => Array.isArray(r));
}

export default function MetasPage() {
  const supabase = createClientComponentClient();
  const [perfil, setPerfil] = useState<any>(null);
  const [dataGlobal, setDataGlobal] = useState<any>(null);
  const [dataEjecutivos, setDataEjecutivos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargarDatos() {
      setLoading(true);

      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: perfilData } = await supabase
        .from("profiles")
        .select("display_name, department, email, role")
        .eq("id", user.id)
        .single();

      setPerfil(perfilData);

      // === Determinar Gerencia según department ===
      let filtroGerencia = "";
      if (perfilData?.department === "gerencia_food") filtroGerencia = "CBORQUEZ";
      else if (perfilData?.department === "gerencia_hc") filtroGerencia = "CAVENDANO";
      else if (perfilData?.department === "gerencia_ind") filtroGerencia = "ADAMM";

      // === URLs de las hojas CSV ===
      const metasURL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vS6eHEKLPnnwmtrSFaNvShM3zjdoJ7kr7gmaq6qK1giAXgBm4xulZ1ChS460ejlFUCfabxTect725wf/pub?gid=0&single=true&output=csv";
      const ventasURL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vQXztj-EM_OgRPoKxjRiMleVhH0QVWzG7RSpGIwqMXjUwc_9ENeOYeV9VIcoTpN45vAF3HGZlWl7f4Q/pub?gid=0&single=true&output=csv";

      const [metasText, ventasText] = await Promise.all([
        fetch(metasURL).then((r) => r.text()),
        fetch(ventasURL).then((r) => r.text()),
      ]);

      const metasRows = parseCSV(metasText);
      const ventasRows = parseCSV(ventasText);

      const metas = normalizarFilas(metasRows);
      const ventas = normalizarFilas(ventasRows);

      // === Filtrar por gerencia ===
      const metasFiltradas = metas.filter(
        (r) => clean(r[0]).toUpperCase() === filtroGerencia.toUpperCase()
      );
      const ventasFiltradas = ventas.filter(
        (r) => clean(r[0]).toUpperCase() === filtroGerencia.toUpperCase()
      );

      const meses = metasRows[0].slice(2, 14); // Enero-Diciembre
      const mesActual = new Date().getMonth(); // 0-11

      // === Calcular totales globales ===
      let totalMeta = 0;
      let totalVenta = 0;
      const dataTrend: { mes: string; Meta: number; Venta: number }[] = [];

      meses.forEach((mes, i) => {
        const sumaMeta = metasFiltradas.reduce(
          (acc, r) =>
            acc +
            (parseFloat(String(r[i + 2] || "0").replace(/\./g, "").replace(",", ".")) ||
              0),
          0
        );

        // Evita duplicados en ventas: suma solo una fila por ejecutivo único
        const ventasUnicas = Array.from(
          new Map(
            ventasFiltradas.map((v) => [clean(v[1]).toUpperCase(), v])
          ).values()
        );

        const sumaVenta = ventasUnicas.reduce(
          (acc, r) =>
            acc +
            (parseFloat(String(r[i + 2] || "0").replace(/\./g, "").replace(",", ".")) ||
              0),
          0
        );

        totalMeta += sumaMeta;
        totalVenta += sumaVenta;

        dataTrend.push({
          mes,
          Meta: sumaMeta,
          Venta: sumaVenta,
        });
      });

      // === Cumplimiento general ===
      const cumplimientoTotal =
        totalMeta > 0 ? ((totalVenta / totalMeta) * 100).toFixed(1) : "0";

      // === Cumplimiento por ejecutivo (mes actual) ===
      const ventasUnicasMes = Array.from(
        new Map(
          ventasFiltradas.map((v) => [clean(v[1]).toUpperCase(), v])
        ).values()
      );

      const dataEjecutivosTemp = metasFiltradas.map((r) => {
        const nombre = clean(r[1]).toUpperCase();
        const meta = parseFloat(
          String(r[mesActual + 2] || "0").replace(/\./g, "").replace(",", ".")
        );
        const filaVenta = ventasUnicasMes.find(
          (v) => clean(v[1]).toUpperCase() === nombre
        );
        const venta = parseFloat(
          String(filaVenta?.[mesActual + 2] || "0")
            .replace(/\./g, "")
            .replace(",", ".")
        );
        const cumplimiento = meta > 0 ? (venta / meta) * 100 : 0;
        return {
          ejecutivo: nombre,
          meta,
          venta,
          cumplimiento: cumplimiento.toFixed(0),
        };
      });

      setDataGlobal({
        totalMeta,
        totalVenta,
        cumplimientoTotal,
        dataTrend,
        mesActual: meses[mesActual],
      });
      setDataEjecutivos(dataEjecutivosTemp);
      setLoading(false);
    }

    cargarDatos();
  }, []);

  if (loading) return <p className="p-8 text-gray-500">Cargando datos...</p>;
  if (!dataGlobal)
    return (
      <p className="p-8 text-gray-500">
        No se encontraron datos para esta gerencia.
      </p>
    );

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-900 mb-2">
        Cumplimiento de Metas 2025
      </h1>
      <p className="text-gray-600 mb-6">
        Gerencia:{" "}
        <span className="font-semibold text-blue-800">
          {perfil?.department?.replace("gerencia_", "").toUpperCase()}
        </span>{" "}
        — {perfil?.email}
      </p>

      {/* === Indicadores === */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        <div className="bg-white border rounded-xl p-5 text-center shadow-sm">
          <h3 className="text-gray-600 mb-2 font-medium">Meta Total Anual</h3>
          <p className="text-2xl font-bold text-blue-800">
            {dataGlobal.totalMeta.toLocaleString("es-CL")}
          </p>
        </div>
        <div className="bg-white border rounded-xl p-5 text-center shadow-sm">
          <h3 className="text-gray-600 mb-2 font-medium">Venta Total Anual</h3>
          <p className="text-2xl font-bold text-green-700">
            {dataGlobal.totalVenta.toLocaleString("es-CL")}
          </p>
        </div>
        <div className="bg-white border rounded-xl p-5 text-center shadow-sm">
          <h3 className="text-gray-600 mb-2 font-medium">% Cumplimiento</h3>
          <p
            className={`text-2xl font-bold ${
              parseFloat(dataGlobal.cumplimientoTotal) >= 100
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            {dataGlobal.cumplimientoTotal}%
          </p>
        </div>
      </div>

      {/* === Gráfico === */}
      <div className="bg-white border rounded-xl p-6 shadow-sm mb-10">
        <h2 className="text-lg font-semibold mb-4 text-gray-700">
          Tendencia Meta vs Venta (Total Gerencia)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dataGlobal.dataTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="Meta"
              stroke="#1d4ed8"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="Venta"
              stroke="#16a34a"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* === Tabla === */}
      <div className="bg-white border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-gray-700">
          Cumplimiento de Ejecutivos — {dataGlobal.mesActual}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-600">
                <th className="text-left py-2 px-3">Ejecutivo</th>
                <th className="text-right py-2 px-3">Meta</th>
                <th className="text-right py-2 px-3">Venta</th>
                <th className="text-right py-2 px-3">% Cumplimiento</th>
              </tr>
            </thead>
            <tbody>
              {dataEjecutivos.map((e, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3 font-medium text-gray-800">
                    {e.ejecutivo}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {e.meta.toLocaleString("es-CL")}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {e.venta.toLocaleString("es-CL")}
                  </td>
                  <td
                    className={`py-2 px-3 text-right font-semibold ${
                      e.cumplimiento >= 100
                        ? "text-green-600"
                        : e.cumplimiento >= 70
                        ? "text-orange-500"
                        : "text-red-600"
                    }`}
                  >
                    {e.cumplimiento}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
