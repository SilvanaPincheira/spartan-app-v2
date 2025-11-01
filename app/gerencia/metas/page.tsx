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

export default function MetasPage() {
  const supabase = createClientComponentClient();

  const [perfil, setPerfil] = useState<any>(null);
  const [metas, setMetas] = useState<any[]>([]);
  const [ventas, setVentas] = useState<any[]>([]);
  const [mensual, setMensual] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 🔗 URLs oficiales publicadas como CSV
  const SHEET_METAS =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vS6eHEKLPnnwmtrSFaNvShM3zjdoJ7kr7gmaq6qK1giAXgBm4xulZ1ChS460ejlFUCfabxTect725wf/pub?gid=0&single=true&output=csv";
  const SHEET_VENTAS =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQXztj-EM_OgRPoKxjRiMleVhH0QVWzG7RSpGIwqMXjUwc_9ENeOYeV9VIcoTpN45vAF3HGZlWl7f4Q/pub?gid=0&single=true&output=csv";

  useEffect(() => {
    async function cargarDatos() {
      setLoading(true);

      // 1️⃣ Obtener perfil desde Supabase
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (user) {
        const { data: perfilData } = await supabase
          .from("profiles")
          .select("role, department, display_name")
          .eq("id", user.id)
          .single();
        setPerfil(perfilData);
      }

      // 2️⃣ Cargar CSV de Metas
      const metasRes = await fetch(SHEET_METAS);
      const metasText = await metasRes.text();
      const metasRows = metasText.split("\n").map((r) => r.split(","));
      const metasHeaders = metasRows[0].map((h) => h.trim());
      const metasBody = metasRows.slice(1);

      const dataMetas = metasBody
        .filter((r) => r[0]?.trim() !== "")
        .map((r) => {
          const obj: any = { ejecutivo: r[0] };
          metasHeaders.slice(1).forEach((mes, i) => {
            obj[mes] = parseFloat(r[i + 1]) || 0;
          });
          return obj;
        });
      setMetas(dataMetas);

      // 3️⃣ Cargar CSV de Ventas
      const ventasRes = await fetch(SHEET_VENTAS);
      const ventasText = await ventasRes.text();
      const ventasRows = ventasText.split("\n").map((r) => r.split(","));
      const ventasHeaders = ventasRows[0].map((h) => h.trim());
      const ventasBody = ventasRows.slice(1);

      const dataVentas = ventasBody
        .filter((r) => r[0]?.trim() !== "")
        .map((r) => {
          const obj: any = { ejecutivo: r[0] };
          ventasHeaders.slice(1).forEach((mes, i) => {
            obj[mes] = parseFloat(r[i + 1]) || 0;
          });
          return obj;
        });
      setVentas(dataVentas);

      // 4️⃣ Calcular promedios mensuales
      const meses = metasHeaders.slice(1);
      const promedioMensual = meses.map((mes) => {
        const metasMes = dataMetas.map((r) => r[mes] || 0);
        const ventasMes = dataVentas.map((r) => r[mes] || 0);
        const metaProm = metasMes.reduce((a, b) => a + b, 0) / (metasMes.length || 1);
        const ventaProm = ventasMes.reduce((a, b) => a + b, 0) / (ventasMes.length || 1);
        return {
          mes,
          meta: Math.round(metaProm),
          venta: Math.round(ventaProm),
          cumplimiento: metaProm > 0 ? Math.round((ventaProm / metaProm) * 100) : 0,
        };
      });

      setMensual(promedioMensual);
      setLoading(false);
    }

    cargarDatos();
  }, []);

  if (loading)
    return (
      <div className="p-8">
        <p className="text-gray-500">Cargando metas y ventas reales...</p>
      </div>
    );

  // 5️⃣ Calcular promedio total anual
  const totalMeta = mensual.reduce((sum, m) => sum + m.meta, 0);
  const totalVenta = mensual.reduce((sum, m) => sum + m.venta, 0);
  const totalCumplimiento =
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

      {/* === KPI principal === */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-5 border rounded-2xl shadow-sm">
          <h3 className="text-gray-600 text-sm">Meta Total Anual</h3>
          <p className="text-2xl font-bold text-blue-800">
            {totalMeta.toLocaleString("es-CL")}
          </p>
        </div>
        <div className="bg-white p-5 border rounded-2xl shadow-sm">
          <h3 className="text-gray-600 text-sm">Venta Total Anual</h3>
          <p className="text-2xl font-bold text-green-700">
            {totalVenta.toLocaleString("es-CL")}
          </p>
        </div>
        <div className="bg-white p-5 border rounded-2xl shadow-sm">
          <h3 className="text-gray-600 text-sm">% Cumplimiento</h3>
          <p
            className={`text-2xl font-bold ${
              totalCumplimiento >= 100
                ? "text-green-600"
                : totalCumplimiento >= 80
                ? "text-yellow-600"
                : "text-red-600"
            }`}
          >
            {totalCumplimiento}%
          </p>
        </div>
      </div>

      {/* === Gráfico === */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border mb-10">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          Tendencia Meta vs Venta Promedio
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={mensual}>
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
              name="Meta Promedio"
            />
            <Line
              type="monotone"
              dataKey="venta"
              stroke="#16a34a"
              strokeWidth={3}
              name="Venta Promedio"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* === Tabla mensual === */}
      <div className="bg-white border rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          Cumplimiento Promedio Mensual
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 border-b">
                <th className="py-2 px-3 text-left">Mes</th>
                <th className="py-2 px-3 text-right">Meta Promedio</th>
                <th className="py-2 px-3 text-right">Venta Promedio</th>
                <th className="py-2 px-3 text-right">% Cumplimiento</th>
              </tr>
            </thead>
            <tbody>
              {mensual.map((r, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3 font-medium text-gray-800">{r.mes}</td>
                  <td className="py-2 px-3 text-right text-gray-700">
                    {r.meta.toLocaleString("es-CL")}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-700">
                    {r.venta.toLocaleString("es-CL")}
                  </td>
                  <td
                    className={`py-2 px-3 text-right font-semibold ${
                      r.cumplimiento >= 100
                        ? "text-green-600"
                        : r.cumplimiento >= 80
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}
                  >
                    {r.cumplimiento}%
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
