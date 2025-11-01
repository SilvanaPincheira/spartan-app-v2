"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { FiUsers, FiStar, FiShoppingCart, FiTrendingUp } from "react-icons/fi";

export default function ClientesPage() {
  // 🔹 Datos sintéticos simulando clientes
  const topClientes = [
    { nombre: "Supermercado Araya", total: 2400000 },
    { nombre: "Panadería Don Luis", total: 1900000 },
    { nombre: "Hotel Pacific", total: 1750000 },
    { nombre: "Café Milano", total: 1600000 },
    { nombre: "Carnes El Gaucho", total: 1500000 },
    { nombre: "Restaurante Italia", total: 1450000 },
  ];

  const resumen = {
    clientesActivos: 243,
    clientesInactivos: 38,
    clientesNuevos: 12,
    preciosEspeciales: 47,
    clientesMensuales: 186, // compran todos los meses
  };

  const dataPie = [
    { name: "Activos", value: resumen.clientesActivos },
    { name: "Inactivos", value: resumen.clientesInactivos },
  ];

  const COLORS = ["#00A86B", "#FF6347"];

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-900 mb-2">Clientes</h1>
      <p className="text-gray-600 mb-8">
        Análisis del comportamiento y actividad de clientes del área Food & Beverage.
      </p>

      {/* 🔹 KPIs principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <FiUsers className="text-blue-700" size={24} />
            <h2 className="text-lg font-semibold text-gray-700">Clientes Activos</h2>
          </div>
          <p className="text-2xl font-bold text-blue-900">{resumen.clientesActivos}</p>
        </div>

        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <FiShoppingCart className="text-green-600" size={24} />
            <h2 className="text-lg font-semibold text-gray-700">Clientes Nuevos</h2>
          </div>
          <p className="text-2xl font-bold text-green-700">{resumen.clientesNuevos}</p>
        </div>

        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <FiStar className="text-orange-500" size={24} />
            <h2 className="text-lg font-semibold text-gray-700">Precios Especiales</h2>
          </div>
          <p className="text-2xl font-bold text-orange-600">{resumen.preciosEspeciales}</p>
        </div>

        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-2">
            <FiTrendingUp className="text-purple-600" size={24} />
            <h2 className="text-lg font-semibold text-gray-700">Compran Todos los Meses</h2>
          </div>
          <p className="text-2xl font-bold text-purple-700">{resumen.clientesMensuales}</p>
        </div>
      </div>

      {/* 🔹 Gráfico de torta Activos vs Inactivos */}
      <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Distribución de Clientes</h2>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={dataPie} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              } outerRadius={120} dataKey="value">
              {dataPie.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Legend />
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 🔹 Ranking de clientes */}
      <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Top Clientes por Ventas ($)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart layout="vertical" data={topClientes} margin={{ left: 80 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="nombre" type="category" />
            <Tooltip formatter={(value: number) => `$${value.toLocaleString("es-CL")}`} />
            <Bar dataKey="total" fill="#0033A0" name="Ventas ($)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
