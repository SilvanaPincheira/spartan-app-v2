"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { FaMedal } from "react-icons/fa";

/* === UTILIDADES === */
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
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

      /* === Determinar filtro de gerencia === */
      let filtroGerencia = "";
      if (perfilData.department === "gerencia_food") filtroGerencia = "CBORQUEZ";
      else if (perfilData.department === "gerencia_hc") filtroGerencia = "CAVENDANO";
      else if (perfilData.department === "gerencia_ind") filtroGerencia = "ADAMM";

      /* === Leer hoja de Ventas === */
      const ventasURL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vQXztj-EM_OgRPoKxjRiMleVhH0QVWzG7RSpGIwqMXjUwc_9ENeOYeV9VIcoTpN45vAF3HGZlWl7f4Q/pub?gid=0&single=true&output=csv";

      const ventasText = await fetch(ventasURL).then((r) => r.text());
      const ventasRows = parseCSV(ventasText);
      const ventas = ventasRows
        .slice(1)
        .filter((r) => clean(r[0]).toUpperCase() === filtroGerencia.toUpperCase());

      /* === Calcular ventas anuales === */
      const meses = ventasRows[0].slice(2, 13); // Enero - Octubre
      const rankingTemp = ventas.map((r) => {
        const nombre = r[1];
        const ventasTotales = r
          .slice(2, 13)
          .reduce((acc, val) => acc + (parseFloat(val.replace(/\./g, "").replace(",", ".")) || 0), 0);
        return { nombre, ventasTotales };
      });

      const totalGeneral = rankingTemp.reduce((acc, r) => acc + r.ventasTotales, 0);

      const rankingFinal = rankingTemp
        .sort((a, b) => b.ventasTotales - a.ventasTotales)
        .slice(0, 5)
        .map((r, i) => ({
          ...r,
          posicion: i + 1,
          porcentaje: totalGeneral > 0 ? ((r.ventasTotales / totalGeneral) * 100).toFixed(1) : "0.0",
        }));

      setRanking(rankingFinal);
      setLoading(false);
    }

    cargarDatos();
  }, []);

  if (loading) return <p className="p-8 text-gray-500">Cargando datos...</p>;

  /* === UI === */
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-900 mb-2">
        Equipo — {perfil?.department?.replace("gerencia_", "").toUpperCase()}
      </h1>
      <p className="text-gray-600 mb-8">
        Desempeño del equipo por ventas acumuladas (Enero–{new Date().toLocaleString("es-CL", { month: "long" })})
      </p>

      {/* === Top 5 ejecutivos === */}
      <div className="bg-white border rounded-2xl shadow-sm p-6 mb-10">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">🏆 Top 5 Ejecutivos por Ventas</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-gray-600">
              <th className="text-left py-2 px-3">Pos.</th>
              <th className="text-left py-2 px-3">Ejecutivo</th>
              <th className="text-right py-2 px-3">Venta total ($)</th>
              <th className="text-right py-2 px-3">% del total</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((r) => (
              <tr key={r.nombre} className="border-b hover:bg-gray-50 transition">
                <td className="py-2 px-3 font-semibold">
                  <div className="flex items-center gap-2">
                    <FaMedal
                      size={18}
                      className={
                        r.posicion === 1
                          ? "text-yellow-400"
                          : r.posicion === 2
                          ? "text-gray-400"
                          : r.posicion === 3
                          ? "text-amber-700"
                          : "text-blue-300"
                      }
                    />
                    {r.posicion}
                  </div>
                </td>
                <td className="py-2 px-3 text-gray-800 font-medium">{r.nombre}</td>
                <td className="py-2 px-3 text-right font-semibold text-blue-900">
                  {r.ventasTotales.toLocaleString("es-CL")}
                </td>
                <td className="py-2 px-3 text-right text-gray-600">
                  {r.porcentaje}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* === Placeholders para siguientes módulos === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">👥 Clientes nuevos por ejecutivo</h2>
          <p className="text-gray-500 text-sm">
            Aquí mostraremos los clientes nuevos y su impacto en ventas ($), una vez tengamos la hoja “Clientes Nuevos 2025”.
          </p>
        </div>
        <div className="bg-white border rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">💰 Convenios y precios especiales</h2>
          <p className="text-gray-500 text-sm">
            Aquí se mostrará la cantidad de convenios activos y clientes con precios especiales (SAP o Google Sheets).
          </p>
        </div>
      </div>
    </div>
  );
}
