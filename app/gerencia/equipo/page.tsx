"use client";

import { useState } from "react";
import { FiUsers, FiTrendingUp } from "react-icons/fi";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

type Ejecutivo = {
  nombre: string;
  ventasMes: number;
  ventasAnio: number;
  clientesNuevos: number;
};

export default function EquipoPage() {
  // 🔹 Datos sintéticos simulando rendimiento del equipo
  const dataEjecutivos: Ejecutivo[] = [
    { nombre: "Ana Díaz", ventasMes: 12400000, ventasAnio: 68000000, clientesNuevos: 3 },
    { nombre: "Jorge Pérez", ventasMes: 7800000, ventasAnio: 59000000, clientesNuevos: 2 },
    { nombre: "Luis Soto", ventasMes: 4900000, ventasAnio: 42000000, clientesNuevos: 1 },
    { nombre: "María González", ventasMes: 8800000, ventasAnio: 54000000, clientesNuevos: 2 },
    { nombre: "Carlos Rivas", ventasMes: 3100000, ventasAnio: 38000000, clientesNuevos: 0 },
  ];

  const [hovered, setHovered] = useState<string | null>(null);

  // 🔹 Calcular totales globales
  const totalVentasMes = dataEjecutivos.reduce((acc, e) => acc + e.ventasMes, 0);
  const totalClientesNuevos = dataEjecutivos.reduce((acc, e) => acc + e.clientesNuevos, 0);

  // 🔹 Función para color según nivel de venta
  const getColor = (valor: number) => {
    if (valor >= 10000000) return "bg-green-100 text-green-700";
    if (valor >= 5000000) return "bg-orange-100 text-orange-700";
    return "bg-red-100 text-red-700";
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-900 mb-2">Equipo de Ventas</h1>
      <p className="text-gray-600 mb-8">
        Rendimiento individual, clientes nuevos y desempeño global del equipo.
      </p>

      {/* 🔹 Resumen Global */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <FiTrendingUp className="text-blue-700" size={26} />
            <h2 className="text-lg font-semibold text-gray-700">Ventas Totales del Mes</h2>
          </div>
          <p className="text-2xl font-bold text-blue-900">${totalVentasMes.toLocaleString("es-CL")}</p>
        </div>

        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <FiUsers className="text-green-700" size={26} />
            <h2 className="text-lg font-semibold text-gray-700">Clientes Nuevos</h2>
          </div>
          <p className="text-2xl font-bold text-green-700">{totalClientesNuevos}</p>
        </div>
      </div>

      {/* 🔹 Gráfico de Ventas Mensuales */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Ventas Mensuales por Ejecutivo</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dataEjecutivos}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="nombre" />
            <YAxis />
            <Tooltip formatter={(value: number) => `$${value.toLocaleString("es-CL")}`} />
            <Legend />
            <Bar dataKey="ventasMes" fill="#0033A0" name="Ventas del Mes" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 🔹 Tabla de Rendimiento */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Detalle del Equipo</h2>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-sm text-gray-600 border-b">
              <th className="pb-2">Ejecutivo</th>
              <th className="pb-2">Ventas Mes</th>
              <th className="pb-2">Ventas Año</th>
              <th className="pb-2">Clientes Nuevos</th>
              <th className="pb-2 text-center">Rendimiento</th>
            </tr>
          </thead>
          <tbody>
            {dataEjecutivos.map((e, i) => (
              <tr
                key={i}
                className={`text-sm border-b hover:bg-gray-50 transition ${
                  hovered === e.nombre ? "bg-blue-50" : ""
                }`}
                onMouseEnter={() => setHovered(e.nombre)}
                onMouseLeave={() => setHovered(null)}
              >
                <td className="py-2">{e.nombre}</td>
                <td className="py-2">${e.ventasMes.toLocaleString("es-CL")}</td>
                <td className="py-2">${e.ventasAnio.toLocaleString("es-CL")}</td>
                <td className="py-2 text-center">{e.clientesNuevos}</td>
                <td className="py-2 text-center">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${getColor(
                      e.ventasMes
                    )}`}
                  >
                    {e.ventasMes >= 10000000
                      ? "🟢 Alto"
                      : e.ventasMes >= 5000000
                      ? "🟠 Medio"
                      : "🔴 Bajo"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
