"use client";

import { useRouter } from "next/navigation";
import { FiTrendingUp, FiUsers, FiShoppingBag, FiBarChart2, FiTarget } from "react-icons/fi";

export default function GerenciaPage() {
  const router = useRouter();

  const cards = [
    {
      title: "Metas",
      value: "86% de avance",
      description: "Cumplimiento de metas mensuales",
      icon: <FiTarget className="text-blue-600" size={28} />,
      link: "/gerencia/metas",
    },
    {
      title: "Equipo",
      value: "7 ejecutivos activos",
      description: "Rendimiento y ventas por ejecutivo",
      icon: <FiUsers className="text-green-600" size={28} />,
      link: "/gerencia/equipo",
    },
    {
      title: "Clientes",
      value: "243 activos / 38 inactivos",
      description: "Clientes nuevos, frecuentes y con precios especiales",
      icon: <FiBarChart2 className="text-orange-500" size={28} />,
      link: "/gerencia/clientes",
    },
    {
      title: "Productos",
      value: "Top ventas en $ y Kg",
      description: "Mix de productos y márgenes",
      icon: <FiShoppingBag className="text-indigo-600" size={28} />,
      link: "/gerencia/productos",
    },
    {
      title: "Rendimiento",
      value: "Margen total: 18.2%",
      description: "Análisis financiero y eficiencia del área",
      icon: <FiTrendingUp className="text-emerald-600" size={28} />,
      link: "/gerencia/rendimiento",
    },
  ];

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-900 mb-2">Panel Gerencial — Food & Beverage</h1>
      <p className="text-gray-600 mb-8">Resumen general de tu área con indicadores clave de desempeño</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card, i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition cursor-pointer"
            onClick={() => router.push(card.link)}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {card.icon}
                <h2 className="text-lg font-semibold text-gray-800">{card.title}</h2>
              </div>
            </div>
            <p className="text-2xl font-bold text-blue-900">{card.value}</p>
            <p className="text-sm text-gray-500 mt-1">{card.description}</p>
            <div className="mt-4 text-right">
              <button
                onClick={() => router.push(card.link)}
                className="text-blue-700 font-medium hover:underline"
              >
                Ver detalle →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
