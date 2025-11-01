"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { FiBox, FiTrendingUp, FiArrowDownCircle } from "react-icons/fi";

export default function ProductosPage() {
  // 🔹 Datos sintéticos simulando análisis de productos
  const productosVentas = [
    { producto: "Queso 1kg", ventas: 3200000, kilos: 480, margen: 22 },
    { producto: "Tocino 2kg", ventas: 2100000, kilos: 340, margen: 11 },
    { producto: "Fiambre Mix", ventas: 1900000, kilos: 520, margen: 8 },
    { producto: "Jamón Premium", ventas: 1750000, kilos: 290, margen: 24 },
    { producto: "Salame 1kg", ventas: 1650000, kilos: 310, margen: 18 },
    { producto: "Mortadela", ventas: 1400000, kilos: 260, margen: 9 },
  ];

  // 🔹 Top 3 por margen
  const topMargen = [...productosVentas].sort((a, b) => b.margen - a.margen).slice(0, 3);
  const bajoMargen = [...productosVentas].sort((a, b) => a.margen - b.margen).slice(0, 3);

  const totalVentas = productosVentas.reduce((acc, p) => acc + p.ventas, 0);
  const promedioMargen = (
    productosVentas.reduce((acc, p) => acc + p.margen, 0) / productosVentas.length
  ).toFixed(1);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-900 mb-2">Productos</h1>
      <p className="text-gray-600 mb-8">
        Análisis de productos más vendidos, volúmenes y márgenes promedio.
      </p>

      {/* 🔹 KPIs Globales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <FiBox className="text-blue-700" size={26} />
            <h2 className="text-lg font-semibold text-gray-700">Ventas Totales</h2>
          </div>
          <p className="text-2xl font-bold text-blue-900">
            ${totalVentas.toLocaleString("es-CL")}
          </p>
        </div>

        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <FiTrendingUp className="text-green-700" size={26} />
            <h2 className="text-lg font-semibold text-gray-700">Margen Promedio</h2>
          </div>
          <p className="text-2xl font-bold text-green-700">{promedioMargen}%</p>
        </div>

        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <FiArrowDownCircle className="text-orange-600" size={26} />
            <h2 className="text-lg font-semibold text-gray-700">Top con Bajo Margen</h2>
          </div>
          <p className="text-2xl font-bold text-orange-700">{bajoMargen.length}</p>
        </div>
      </div>

      {/* 🔹 Gráfico Ventas en $ */}
      <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Productos más vendidos ($)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={productosVentas} margin={{ left: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="producto" />
            <YAxis />
            <Tooltip formatter={(value: number) => `$${value.toLocaleString("es-CL")}`} />
            <Legend />
            <Bar dataKey="ventas" fill="#0033A0" name="Ventas ($)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 🔹 Gráfico Kilos Vendidos */}
      <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Productos más vendidos (Kg)
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={productosVentas} margin={{ left: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="producto" />
            <YAxis />
            <Tooltip formatter={(value: number) => `${value.toLocaleString("es-CL")} Kg`} />
            <Legend />
            <Bar dataKey="kilos" fill="#00A86B" name="Kilos Vendidos" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 🔹 Tablas de Margen */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Top 3 Mayor Margen</h2>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-sm text-gray-600 border-b">
                <th className="pb-2">Producto</th>
                <th className="pb-2">Margen %</th>
              </tr>
            </thead>
            <tbody>
              {topMargen.map((p, i) => (
                <tr key={i} className="text-sm border-b hover:bg-gray-50">
                  <td className="py-2">{p.producto}</td>
                  <td className="py-2 text-green-700 font-semibold">{p.margen}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Top 3 Menor Margen</h2>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-sm text-gray-600 border-b">
                <th className="pb-2">Producto</th>
                <th className="pb-2">Margen %</th>
              </tr>
            </thead>
            <tbody>
              {bajoMargen.map((p, i) => (
                <tr key={i} className="text-sm border-b hover:bg-gray-50">
                  <td className="py-2">{p.producto}</td>
                  <td className="py-2 text-red-600 font-semibold">{p.margen}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
