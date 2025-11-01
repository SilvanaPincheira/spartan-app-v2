"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FiTarget,
  FiUsers,
  FiBarChart2,
  FiShoppingBag,
  FiTrendingUp,
} from "react-icons/fi";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function GerenciaPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [perfil, setPerfil] = useState<any>(null);
  const [filtroGerencia, setFiltroGerencia] = useState<string>("");
  const [fechaActual, setFechaActual] = useState<string>("");

  // Datos de ejemplo (se conectarán a hojas o tablas reales)
  const [metaAvance, setMetaAvance] = useState(25);
  const [ventaEquipo, setVentaEquipo] = useState(45200000);
  const [clientesNuevos, setClientesNuevos] = useState(8);
  const [productoTop, setProductoTop] = useState("Desengrasante F12");
  const [rendimientoPromedio, setRendimientoPromedio] = useState(82);

  useEffect(() => {
    // 🔹 Obtener la fecha actual en formato local
    const hoy = new Date();
    const opcionesFecha = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    } as const;
    setFechaActual(hoy.toLocaleDateString("es-CL", opcionesFecha));

    // 🔹 Cargar perfil desde Supabase
    async function cargarPerfil() {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return;

      const { data: perfilData } = await supabase
        .from("profiles")
        .select("display_name, department, role, email")
        .eq("id", user.id)
        .single();

      if (perfilData) {
        setPerfil(perfilData);

        // Determinar gerencia
        const deptToGerencia: Record<string, string> = {
          gerencia_food: "F&B",
          gerencia_hc: "HC",
          gerencia_ind: "IND",
          gerencia_general: "GENERAL",
        };
        setFiltroGerencia(deptToGerencia[perfilData.department] || "");
      }
    }

    cargarPerfil();
  }, []);

  const cards = [
    {
      title: "Metas",
      value: `${metaAvance}% de avance`,
      description: "Cumplimiento de meta mensual",
      icon: <FiTarget className="text-blue-600" size={28} />,
      link: "/gerencia/metas",
    },
    {
      title: "Equipo",
      value: `$${(ventaEquipo / 1_000_000).toFixed(1)} M`,
      description: "Venta total del equipo",
      icon: <FiUsers className="text-green-600" size={28} />,
      link: "/gerencia/equipo",
    },
    {
      title: "Clientes",
      value: `${clientesNuevos} nuevos`,
      description: "Clientes nuevos del mes",
      icon: <FiBarChart2 className="text-orange-500" size={28} />,
      link: "/gerencia/clientes",
    },
    {
      title: "Productos",
      value: productoTop,
      description: "Producto más vendido",
      icon: <FiShoppingBag className="text-indigo-600" size={28} />,
      link: "/gerencia/productos",
    },
    {
      title: "Rendimiento",
      value: `${rendimientoPromedio}% promedio`,
      description: "Desempeño global del equipo",
      icon: <FiTrendingUp className="text-emerald-600" size={28} />,
      link: "/gerencia/rendimiento",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ==== ENCABEZADO AZUL SPARTAN ==== */}
      <header className="bg-[#1f4ed8] text-white py-6 px-8 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">SPARTAN ONE</h1>
            <p className="text-sm opacity-90">
              Bienvenido al panel central de gestión y reportes.
            </p>
          </div>
          {perfil && (
            <div className="mt-4 sm:mt-0">
              <p className="text-sm">
                👋 Bienvenido/a,{" "}
                <span className="font-semibold">{perfil.email}</span>
              </p>
              <p className="text-xs opacity-90">{fechaActual}</p>
            </div>
          )}
        </div>
      </header>

      {/* ==== CONTENIDO PRINCIPAL ==== */}
      <main className="flex-1 p-8">
        <h2 className="text-xl font-bold text-blue-900 mb-6">
          Panel Gerencial — {filtroGerencia || "General"}
        </h2>

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
                  <h2 className="text-lg font-semibold text-gray-800">
                    {card.title}
                  </h2>
                </div>
              </div>
              <p className="text-2xl font-bold text-blue-900">{card.value}</p>
              <p className="text-sm text-gray-500 mt-1">{card.description}</p>
              <div className="mt-4 text-right">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(card.link);
                  }}
                  className="text-blue-700 font-medium hover:underline"
                >
                  Ver detalle →
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
