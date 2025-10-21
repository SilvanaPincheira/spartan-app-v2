"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";

const topVendedores = [
  { name: "Alexandra", ventas: 12000000 },
  { name: "Cristian", ventas: 10800000 },
  { name: "Silvana", ventas: 9500000 },
  { name: "Nelson", ventas: 8800000 },
  { name: "Valentina", ventas: 7900000 },
];

const topProductos = [
  { name: "Desinfectante X", ventas: 9500000 },
  { name: "Limpiador Multiuso", ventas: 8300000 },
  { name: "Detergente Industrial", ventas: 7200000 },
  { name: "Aromatizante", ventas: 6100000 },
  { name: "Pasta Pulidora", ventas: 5900000 },
];

export default function SpartanGerencial() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 relative">

      {/* === Botón hamburguesa === */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="p-2 bg-[#2B6CFF] text-white rounded-md fixed top-4 left-4 z-50 shadow-md hover:bg-[#1f4ed8]"
      >
        {menuOpen ? "✖" : "☰"}
      </button>

      {/* === Menú lateral (solo visible cuando se abre) === */}
      {menuOpen && (
        <aside className="fixed top-0 left-0 h-full w-64 bg-white shadow-xl p-6 z-40 border-r border-zinc-200">
          <h2 className="text-lg font-bold text-[#2B6CFF] mb-6">
            SPARTAN ONE GERENCIAL
          </h2>
          <nav className="space-y-3 text-sm">
            {[
              "Inicio",
              "Facturación",
              "Productos",
              "Comodatos",
              "Ejecutivos",
              "Metas",
              "Rendimiento",
              "Login",
            ].map((item) => (
              <button
                key={item}
                className="block w-full text-left px-3 py-2 rounded hover:bg-blue-50 hover:text-[#2B6CFF] transition"
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>
      )}

      {/* === Contenido principal === */}
      <main className="max-w-7xl mx-auto px-6 pt-8 md:pt-10 space-y-8">
        {/* Encabezado */}
        <header className="bg-white rounded-2xl shadow-sm p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#2B6CFF]">Panel Gerencial</h1>
            <p className="text-sm text-zinc-600">
              Visión global de rendimiento y resultados de la compañía.
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-zinc-500">
              Martes, 21 de octubre de 2025
            </p>
            <p className="font-medium text-emerald-600">
              🚀 Datos actualizados para toma de decisiones estratégicas
            </p>
          </div>
        </header>

        {/* Tarjetas resumen superiores */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-blue-50 border-blue-200 text-center">
            <CardContent className="p-5">
              <h3 className="text-sm font-medium text-zinc-600">
                Ventas del Mes
              </h3>
              <p className="text-2xl font-bold text-[#2B6CFF]">$11.000.000</p>
              <p className="text-xs text-emerald-600 mt-1">▲ +9,8%</p>
            </CardContent>
          </Card>

          <Card className="bg-emerald-50 border-emerald-200 text-center">
            <CardContent className="p-5">
              <h3 className="text-sm font-medium text-zinc-600">
                Cumplimiento Meta
              </h3>
              <p className="text-2xl font-bold text-emerald-600">82%</p>
              <p className="text-xs text-zinc-500 mt-1">
                Avance respecto a la meta mensual
              </p>
            </CardContent>
          </Card>

          <Card className="bg-orange-50 border-orange-200 text-center">
            <CardContent className="p-5">
              <h3 className="text-sm font-medium text-zinc-600">
                Pedidos Pendientes
              </h3>
              <p className="text-2xl font-bold text-orange-600">14</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 border-orange-300 text-orange-600 hover:bg-orange-50"
              >
                Ver
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-sky-50 border-sky-200 text-center">
            <CardContent className="p-5">
              <h3 className="text-sm font-medium text-zinc-600">
                Rendimiento Promedio División
              </h3>
              <p className="text-2xl font-bold text-[#2B6CFF]">89%</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 border-blue-300 text-[#2B6CFF] hover:bg-blue-50"
              >
                Ver Detalle
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Tarjetas de datos clave */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-blue-50 border-blue-200 text-center">
            <CardContent className="p-5">
              <h3 className="text-sm font-medium text-zinc-600">
                Comodatos instalados acumulado
              </h3>
              <p className="text-2xl font-bold text-[#2B6CFF]">$20.544.100</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 border-blue-300 text-[#2B6CFF] hover:bg-blue-50"
              >
                Ver
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-emerald-50 border-emerald-200 text-center">
            <CardContent className="p-5">
              <h3 className="text-sm font-medium text-zinc-600">
                Clientes nuevos del mes
              </h3>
              <p className="text-2xl font-bold text-emerald-600">10</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 border-emerald-300 text-emerald-600 hover:bg-emerald-50"
              >
                Ver
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-orange-50 border-orange-200 text-center">
            <CardContent className="p-5">
              <h3 className="text-sm font-medium text-zinc-600">
                Seguimiento general de área
              </h3>
              <p className="text-xl font-semibold text-orange-600">
                En ejecución
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 border-orange-300 text-orange-600 hover:bg-orange-50"
              >
                Ver detalle
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Top 5 Vendedores y Productos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-[#2B6CFF] mb-3">
                Top 5 Vendedores
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topVendedores}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="ventas" fill="#2B6CFF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-[#2B6CFF] mb-3">
                Top 5 Productos Más Vendidos
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topProductos}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="ventas" fill="#60A5FA" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
