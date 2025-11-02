"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FiTrendingUp,
  FiUsers,
  FiShoppingBag,
  FiBarChart2,
  FiTarget,
} from "react-icons/fi";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* === FUNCIONES UTILITARIAS === */
function clean(value: any) {
  return String(value || "").trim().replace(/\r|\n/g, "").replace(/\s+/g, " ");
}

function parseCSV(text: string) {
  const rows = text.trim().split(/\r?\n/);
  return rows.map((r) => r.split(",").map((v) => v.trim()));
}

export default function GerenciaPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [perfil, setPerfil] = useState<any>(null);
  const [cumplimientoMetas, setCumplimientoMetas] = useState<number | null>(
    null
  );

  /* === CARGAR PERFIL Y CUMPLIMIENTO === */
  useEffect(() => {
    async function cargarDatos() {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return;

      const { data: perfilData } = await supabase
        .from("profiles")
        .select("display_name, department, email, role")
        .eq("id", user.id)
        .single();

      if (!perfilData) return;
      setPerfil(perfilData);

      // === Determinar filtro de gerencia ===
      let filtroGerencia = "";
      if (perfilData.department === "gerencia_food") filtroGerencia = "CBORQUEZ";
      else if (perfilData.department === "gerencia_hc") filtroGerencia = "CAVENDANO";
      else if (perfilData.department === "gerencia_ind") filtroGerencia = "ADAMM";

      // === URLs CSV ===
      const metasURL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vS6eHEKLPnnwmtrSFaNvShM3zjdoJ7kr7gmaq6qK1giAXgBm4xulZ1ChS460ejlFUCfabxTect725wf/pub?gid=0&single=true&output=csv";
      const ventasURL =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vQXztj-EM_OgRPoKxjRiMleVhH0QVWzG7RSpGIwqMXjUwc_9ENeOYeV9VIcoTpN45vAF3HGZlWl7f4Q/pub?gid=0&single=true&output=csv";

      // === Cargar ambos archivos ===
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

      const meses = metasRows[0].slice(2, 14);
      let totalMeta = 0;
      let totalVenta = 0;

      meses.forEach((_, i) => {
        totalMeta += metas.reduce(
          (acc, r) =>
            acc + (parseFloat(r[i + 2]?.replace(/\./g, "").replace(",", ".")) || 0),
          0
        );
        totalVenta += ventas.reduce(
          (acc, r) =>
            acc + (parseFloat(r[i + 2]?.replace(/\./g, "").replace(",", ".")) || 0),
          0
        );
      });

      const cumplimientoTotal =
        totalMeta > 0 ? (totalVenta / totalMeta) * 100 : 0;

      setCumplimientoMetas(parseFloat(cumplimientoTotal.toFixed(1)));
    }

    cargarDatos();
  }, []);

  /* === TARJETAS PRINCIPALES === */
  const cards = [
    {
      title: "Metas",
      value:
        cumplimientoMetas !== null
          ? `${cumplimientoMetas.toFixed(1)}% de avance`
          : "Cargando...",
      description: "Cumplimiento total de la gerencia",
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

  /* === UI === */
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-900 mb-2">
        Panel Gerencial — {perfil?.department?.replace("gerencia_", "").toUpperCase()}
      </h1>
      <p className="text-gray-600 mb-8">
        Bienvenido/a, <strong>{perfil?.email}</strong>
        <br />
        <span className="text-sm text-gray-500">
          {new Date().toLocaleDateString("es-CL", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
      </p>

      {/* === Tarjetas === */}
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
