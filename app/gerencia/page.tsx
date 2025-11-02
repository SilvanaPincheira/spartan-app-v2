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

export default function GerenciaPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [perfil, setPerfil] = useState<any>(null);
  const [cumplimientoMetas, setCumplimientoMetas] = useState<string>("...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargarCumplimiento() {
      try {
        setLoading(true);

        // === 1️⃣ Sesión y perfil ===
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

        // === 2️⃣ URLs de CSV ===
        const metasURL =
          "https://docs.google.com/spreadsheets/d/e/2PACX-1vS6eHEKLPnnwmtrSFaNvShM3zjdoJ7kr7gmaq6qK1giAXgBm4xulZ1ChS460ejlFUCfabxTect725wf/pub?gid=0&single=true&output=csv";
        const ventasURL =
          "https://docs.google.com/spreadsheets/d/e/2PACX-1vQXztj-EM_OgRPoKxjRiMleVhH0QVWzG7RSpGIwqMXjUwc_9ENeOYeV9VIcoTpN45vAF3HGZlWl7f4Q/pub?gid=0&single=true&output=csv";

        const [metasText, ventasText] = await Promise.all([
          fetch(metasURL).then((r) => r.text()),
          fetch(ventasURL).then((r) => r.text()),
        ]);

        // === 3️⃣ Parser CSV por comas ===
        const parseCSV = (text: string) =>
          text
            .trim()
            .split(/\r?\n/)
            .map((line) => line.split(",").map((v) => v.trim()));

        const metas = parseCSV(metasText);
        const ventas = parseCSV(ventasText);

        if (!metas.length || !ventas.length) return;

        // === 4️⃣ Determinar gerencia ===
        let filtroGerencia = "";
        if (perfilData.department === "gerencia_food") filtroGerencia = "CBORQUEZ";
        else if (perfilData.department === "gerencia_hc") filtroGerencia = "CAVENDANO";
        else if (perfilData.department === "gerencia_ind") filtroGerencia = "ADAMM";

        // === 5️⃣ Filtrar datos por gerencia ===
        const metasFiltradas = metas
          .slice(1)
          .filter((r) => r[0]?.toUpperCase() === filtroGerencia.toUpperCase());
        const ventasFiltradas = ventas
          .slice(1)
          .filter((r) => r[0]?.toUpperCase() === filtroGerencia.toUpperCase());

        // === 6️⃣ Calcular avance de mes actual ===
        const mesActual = new Date().getMonth(); // 0=Enero
        let totalMeta = 0;
        let totalVenta = 0;

        metasFiltradas.forEach((r) => {
          const val = parseFloat(r[mesActual + 2]?.replace(/\./g, "").replace(",", "."));
          if (!isNaN(val)) totalMeta += val;
        });
        ventasFiltradas.forEach((r) => {
          const val = parseFloat(r[mesActual + 2]?.replace(/\./g, "").replace(",", "."));
          if (!isNaN(val)) totalVenta += val;
        });

        const cumplimiento =
          totalMeta > 0 ? ((totalVenta / totalMeta) * 100).toFixed(1) : "0";
        setCumplimientoMetas(cumplimiento);
        setLoading(false);
      } catch (error) {
        console.error("Error al calcular cumplimiento:", error);
      }
    }

    cargarCumplimiento();
  }, []);

  const cards = [
    {
      title: "Metas",
      value:
        cumplimientoMetas === "..."
          ? "Cargando..."
          : `${cumplimientoMetas}% de avance`,
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
      <h1 className="text-3xl font-bold text-blue-900 mb-2">
        Panel Gerencial —{" "}
        {perfil?.department
          ? perfil.department.replace("gerencia_", "").toUpperCase()
          : "..."}
      </h1>
      <p className="text-gray-600 mb-8">
        Resumen general del área con indicadores clave de desempeño
      </p>

      {/* === Tarjetas principales === */}
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
