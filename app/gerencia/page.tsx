"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function GerenciaPage() {
  const supabase = createClientComponentClient();

  const [perfil, setPerfil] = useState<any>(null);
  const [ejecutivos, setEjecutivos] = useState<any[]>([]);
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

      // 🔹 Buscar perfil del usuario logueado
      const { data: perfilData, error: perfilError } = await supabase
        .from("profiles")
        .select("display_name, role, department, email")
        .eq("id", user.id)
        .single();

      if (perfilError || !perfilData) {
        setLoading(false);
        return;
      }

      setPerfil(perfilData);

      // 🔹 Si es gerente, obtener su equipo
      if (perfilData.role === "gerencia") {
        // Convertir department -> nombre de gerencia (según tu estructura)
        const deptToGerencia: Record<string, string> = {
          gerencia_food: "F&B",
          gerencia_hc: "HC",
          gerencia_ind: "IND",
          gerencia_general: "GENERAL",
        };

        const gerencia = deptToGerencia[perfilData.department] || null;

        if (gerencia) {
          const { data: ejecutivosData } = await supabase
            .from("ejecutivos")
            .select("id, nombre, zona, cargo, activo, supervisor")
            .eq("gerencia", gerencia)
            .eq("activo", true);

          setEjecutivos(ejecutivosData || []);
        }
      }

      setLoading(false);
    }

    cargarDatos();
  }, []);

  if (loading)
    return (
      <div className="p-8">
        <p className="text-gray-500">Cargando datos de gerencia...</p>
      </div>
    );

  if (!perfil)
    return (
      <div className="p-8">
        <p className="text-gray-600">
          No se encontró información de perfil. Inicia sesión nuevamente.
        </p>
      </div>
    );

  return (
    <div className="p-8">
      {/* === Encabezado === */}
      <h1 className="text-3xl font-bold text-blue-900 mb-2">
        Panel de Gerencia
      </h1>
      <p className="text-gray-600 mb-8">
        Bienvenido/a, <strong>{perfil.display_name || "Usuario"}</strong>{" "}
        <br />
        <span className="text-sm text-gray-500">
          ({perfil.department?.replace("gerencia_", "").toUpperCase()} ·{" "}
          {perfil.role})
        </span>
      </p>

      {/* === Tarjetas resumen === */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <h2 className="text-gray-700 font-semibold mb-1">Ejecutivos activos</h2>
          <p className="text-3xl font-bold text-blue-900">
            {ejecutivos.length}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <h2 className="text-gray-700 font-semibold mb-1">Zonas cubiertas</h2>
          <p className="text-3xl font-bold text-green-700">
            {[...new Set(ejecutivos.map((e) => e.zona))].length}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <h2 className="text-gray-700 font-semibold mb-1">Supervisores</h2>
          <p className="text-3xl font-bold text-orange-600">
            {[...new Set(ejecutivos.map((e) => e.supervisor))].length}
          </p>
        </div>
      </div>

      {/* === Accesos a submódulos === */}
      <h2 className="text-xl font-semibold text-gray-700 mb-4">Submódulos</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { name: "Metas", href: "/gerencia/metas", icon: "🎯" },
          { name: "Equipo", href: "/gerencia/equipo", icon: "👥" },
          { name: "Clientes", href: "/gerencia/clientes", icon: "📊" },
          { name: "Productos", href: "/gerencia/productos", icon: "📦" },
          { name: "Rendimiento", href: "/gerencia/rendimiento", icon: "📈" },
        ].map((card, i) => (
          <Link key={i} href={card.href}>
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{card.icon}</span>
                <h3 className="text-lg font-semibold text-gray-800">
                  {card.name}
                </h3>
              </div>
              <p className="text-gray-500 text-sm">
                Ver detalles de {card.name.toLowerCase()}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* === Tabla del equipo === */}
      {ejecutivos.length > 0 && (
        <>
          <h2 className="text-xl font-semibold text-gray-700 mt-10 mb-3">
            Equipo a cargo
          </h2>
          <div className="overflow-x-auto bg-white border border-gray-200 rounded-2xl shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-600">
                  <th className="text-left py-2 px-4">Nombre</th>
                  <th className="text-left py-2 px-4">Zona</th>
                  <th className="text-left py-2 px-4">Supervisor</th>
                  <th className="text-left py-2 px-4">Cargo</th>
                </tr>
              </thead>
              <tbody>
                {ejecutivos.map((e) => (
                  <tr key={e.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4 font-medium text-gray-800">
                      {e.nombre}
                    </td>
                    <td className="py-2 px-4">{e.zona}</td>
                    <td className="py-2 px-4">{e.supervisor}</td>
                    <td className="py-2 px-4">{e.cargo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
