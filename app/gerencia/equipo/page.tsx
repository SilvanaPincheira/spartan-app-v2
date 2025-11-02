"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* === Utilidades === */
function clean(value: any) {
  return String(value || "").trim().replace(/\r|\n/g, "").replace(/\s+/g, " ");
}
function parseCSV(text: string) {
  const rows = text.trim().split(/\r?\n/);
  return rows.map((r) => r.split(",").map((v) => v.trim()));
}

export default function EquipoPage() {
  const supabase = createClientComponentClient();
  const [perfil, setPerfil] = useState<any>(null);
  const [equipo, setEquipo] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumen, setResumen] = useState({
    totalActivos: 0,
    totalVentas: 0,
    promedioCumplimiento: 0,
  });

  useEffect(() => {
    async function cargarDatos() {
      setLoading(true);

      /* === Sesión y perfil === */
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return;

      const { data: perfilData } = await supabase
        .from("profiles")
        .select("display_name, department, email")
        .eq("id", user.id)
        .single();

      if (!perfilData) return;
      setPerfil(perfilData);

      /* === Determinar filtro gerencia === */
      let filtroGerencia = "";
      if (perfilData.department === "gerencia_food") filtroGerencia = "CBORQUEZ";
      else if (perfilData.department === "gerencia_hc") filtroGerencia = "CAVENDANO";
      else if (perfilData.department === "gerencia_ind") filtroGerencia = "ADAMM";

      /* === Ejecutivos de esta gerencia === */
      const { data: ejecutivos } = await supabase
        .from("ejecutivos")
        .select("id, nombre, zona, supervisor, activo")
        .eq("gerencia", filtroGerencia)
        .eq("activo", true);

      if (!ejecutivos) return;

      /* === Cargar Metas y Ventas === */
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
      const metas = metasRows.slice(1).filter(
        (r) => clean(r[0]).toUpperCase() === filtroGerencia.toUpperCase()
      );
      const ventas = ventasRows.slice(1).filter(
        (r) => clean(r[0]).toUpperCase() === filtroGerencia.toUpperCase()
      );

      const mesActual = new Date().getMonth(); // 0=Enero
      let totalVentas = 0;
      let totalCumplimiento = 0;

      const equipoConDatos = ejecutivos.map((e) => {
        const metaFila = metas.find(
          (r) => clean(r[1]).toUpperCase() === clean(e.nombre).toUpperCase()
        );
        const ventaFila = ventas.find(
          (r) => clean(r[1]).toUpperCase() === clean(e.nombre).toUpperCase()
        );

        const meta = parseFloat(
          metaFila?.[mesActual + 2]?.replace(/\./g, "").replace(",", ".") || "0"
        );
        const venta = parseFloat(
          ventaFila?.[mesActual + 2]?.replace(/\./g, "").replace(",", ".") || "0"
        );

        const cumplimiento = meta > 0 ? (venta / meta) * 100 : 0;
        totalVentas += venta;
        totalCumplimiento += cumplimiento;

        return {
          ...e,
          meta,
          venta,
          cumplimiento: cumplimiento.toFixed(1),
        };
      });

      const promedioCumplimiento =
        equipoConDatos.length > 0
          ? totalCumplimiento / equipoConDatos.length
          : 0;

      setEquipo(equipoConDatos);
      setResumen({
        totalActivos: equipoConDatos.length,
        totalVentas,
        promedioCumplimiento,
      });

      setLoading(false);
    }

    cargarDatos();
  }, []);

  if (loading) return <p className="p-8 text-gray-500">Cargando datos...</p>;

  /* === UI === */
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-900 mb-2">
        Equipo —{" "}
        {perfil?.department
          ? perfil.department.replace("gerencia_", "").toUpperCase()
          : ""}
      </h1>
      <p className="text-gray-600 mb-6">
        Gerente: <strong>{perfil?.display_name || perfil?.email}</strong>
      </p>

      {/* === Resumen === */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        <div className="bg-white border rounded-xl p-5 text-center shadow-sm">
          <h3 className="text-gray-600 mb-1">Ejecutivos activos</h3>
          <p className="text-2xl font-bold text-blue-800">
            {resumen.totalActivos}
          </p>
        </div>
        <div className="bg-white border rounded-xl p-5 text-center shadow-sm">
          <h3 className="text-gray-600 mb-1">Ventas totales mes</h3>
          <p className="text-2xl font-bold text-green-700">
            {resumen.totalVentas.toLocaleString("es-CL")}
          </p>
        </div>
        <div className="bg-white border rounded-xl p-5 text-center shadow-sm">
          <h3 className="text-gray-600 mb-1">Cumplimiento promedio</h3>
          <p className="text-2xl font-bold text-orange-600">
            {resumen.promedioCumplimiento.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* === Tabla de ejecutivos === */}
      <div className="bg-white border rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-gray-600">
              <th className="text-left py-2 px-3">Ejecutivo</th>
              <th className="text-left py-2 px-3">Zona</th>
              <th className="text-left py-2 px-3">Supervisor</th>
              <th className="text-right py-2 px-3">Meta</th>
              <th className="text-right py-2 px-3">Venta</th>
              <th className="text-right py-2 px-3">% Cumpl.</th>
            </tr>
          </thead>
          <tbody>
            {equipo.map((e, i) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="py-2 px-3 font-medium text-gray-800">
                  {e.nombre}
                </td>
                <td className="py-2 px-3">{e.zona || "-"}</td>
                <td className="py-2 px-3">{e.supervisor || "-"}</td>
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

      {/* === Gráfico ranking === */}
      {equipo.length > 0 && (
        <div className="bg-white border rounded-xl shadow-sm p-6 mt-10">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">
            Ranking de Cumplimiento (%)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={equipo}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="nombre" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="cumplimiento" fill="#1d4ed8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
