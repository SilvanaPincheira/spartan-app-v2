"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function VentasPage() {
  const modules = [
    {
      href: "/ventas/cotizacion",
      icon: "📄",
      title: "Cotización Tipo Formulario",
      desc: "Genera y gestiona cotizaciones estándar para tus clientes.",
      color: "bg-blue-50",
    },
    {
      href: "/ventas/historial-cotizaciones-fb",
      icon: "📜",
      title: "Historial de Cotización T. Formulario",
      desc: "Consulta las cotizaciones tipo formulario grabadas por ejecutivo y cliente.",
      color: "bg-blue-100",
    },
    
    {
      href: "/ventas/cotizacion-industrial",
      icon: "⚙️",
      title: "Cotización Dinamica",
      desc: "Crea cotizaciones industriales con formato corporativo Spartan.",
      color: "bg-indigo-50",
    },
    {
      href: "/ventas/historial-cotizacionInd",
      icon: "📂",
      title: "Historial de Cotización Dinamica",
      desc: "Revisa las cotizaciones emitidas con su fecha, cliente, ejecutivo y total.",
      color: "bg-cyan-50",
    },
    
        {
      href: "/ventas/notaventas",
      icon: "📝",
      title: "Nota de Venta",
      desc: "Crea y administra notas de venta con precios especiales y descuentos.",
      color: "bg-emerald-50",
    },
    {
      href: "/ventas/historial-notaventa",
      icon: "📜",
      title: "Historial de Notas de Venta",
      desc: "Consulta las Notas de Venta grabadas, con fecha, cliente, ejecutivo y total.",
      color: "bg-violet-50",
    },
    {
      href: "/ventas/clientesnuevos",
      icon: "👤",
      title: "Ficha de Cliente Nuevo",
      desc: "Solicita la creación de nuevos clientes y envíalos a SAP/Cobranzas.",
      color: "bg-amber-50",
    },
    {
      href: "/ventas/reclamos",
      icon: "🧾",
      title: "Formulario Reclamos de Calidad",
      desc: "Registra reclamos de clientes con detalle del producto, lote y aplicación.",
      color: "bg-sky-50",
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <h1 className="text-2xl font-bold text-[#2B6CFF] mb-6">📊 Módulo de Ventas</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {modules.map((m) => (
          <motion.div
            key={m.href}
            whileHover={{ scale: 1.03 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Link
              href={m.href}
              className={`block rounded-2xl border bg-white shadow-sm hover:shadow-lg transition p-6 ${m.color}`}
            >
              <div className="text-3xl mb-3">{m.icon}</div>
              <h2 className="text-lg font-semibold text-[#2B6CFF] mb-1">
                {m.title}
              </h2>
              <p className="text-sm text-zinc-600 leading-snug">{m.desc}</p>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
