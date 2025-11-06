"use client";

import Link from "next/link";
import { Folder, FileText, Shield, BookOpen, Database, Info, Box } from "lucide-react";

const herramientas = [
  {
    nombre: "Productos",
    descripcion: "Carpeta principal con todo el material de ventas.",
    href: "/herramientas/productos",
    icono: Box,
    color: "bg-blue-100 text-blue-700",
  },
  {
    nombre: "FT - Fichas Técnicas",
    descripcion: "Documentos técnicos y especificaciones de productos.",
    href: "/herramientas/ft-fichas-tecnicas",
    icono: FileText,
    color: "bg-green-100 text-green-700",
  },
  {
    nombre: "HDS - Hojas de Seguridad",
    descripcion: "Hojas de seguridad química actualizadas.",
    href: "/herramientas/hds-hojas-seguridad",
    icono: Shield,
    color: "bg-red-100 text-red-700",
  },
  {
    nombre: "Registros ISP",
    descripcion: "Registros sanitarios vigentes (ISP).",
    href: "/herramientas/registros-isp",
    icono: Database,
    color: "bg-yellow-100 text-yellow-700",
  },
  {
    nombre: "Registros SAG",
    descripcion: "Documentos de registro agrícola y ganadero (SAG).",
    href: "/herramientas/registros-sag",
    icono: Folder,
    color: "bg-emerald-100 text-emerald-700",
  },
  {
    nombre: "Folletos",
    descripcion: "Folletos comerciales y presentaciones.",
    href: "/herramientas/folletos",
    icono: BookOpen,
    color: "bg-purple-100 text-purple-700",
  },
  {
    nombre: "Catálogo",
    descripcion: "Catálogo general de productos Spartan.",
    href: "/herramientas/catalogo",
    icono: Info,
    color: "bg-indigo-100 text-indigo-700",
  },
  {
    nombre: "Info TIPS",
    descripcion: "Planillas y referencias técnicas para ventas.",
    href: "/herramientas/info-tips",
    icono: Info,
    color: "bg-orange-100 text-orange-700",
  },
];

export default function HerramientasPage() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold text-blue-700 mb-2">🧰 Herramientas de Ventas</h1>
      <p className="text-gray-600 mb-8">
        Accede rápidamente a los documentos, fichas técnicas y recursos de apoyo.
        Todos los archivos se sincronizan directamente desde Google Drive.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {herramientas.map((h) => (
          <Link key={h.href} href={h.href}>
            <div
              className={`p-6 rounded-xl shadow-sm border border-gray-200 bg-white hover:shadow-md hover:-translate-y-1 transition cursor-pointer`}
            >
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 ${h.color}`}
              >
                <h.icono size={26} />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">{h.nombre}</h3>
              <p className="text-sm text-gray-600 mt-1">{h.descripcion}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
