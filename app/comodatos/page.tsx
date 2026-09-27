function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  if (sheet.getName() !== "NV") return;

  const NAME_COL = 8;   // Columna con el nombre del ejecutivo
  const EMAIL_COL = 22; // Columna donde guardar el correo

  const ejecutivos = {
    "FB EDUARDO RIOS PACHECO": "eduardo.rios@spartan.cl",
    "IN ALEJANDRO BERRIOS": "alejandro.berrios@spartan.cl",
    "IN IGNACIO ZUÑIGA": "ignacio.zuniga@spartan.cl",
    "IN LUIS SALAZAR": "luis.salazar@spartan.cl",
    "GUSTAVO OLGUIN": "gustavo.olguin@spartan.cl",
    "HC IVES CAMOUSSEIGHT AVILES": "ives.camousseight@spartan.cl",
    "IVAN MARQUEZ MUÑOZ": "ivan.marquez@spartan.cl",
    "PABLO NOVELLA CUEVAS": "pablo.novella@spartan.cl",
    "HERNAN LOPEZ": "hernan.lopez@spartan.cl",
    "PABLO FUENTES ESPINOZA": "pablo.fuentes@spartan.cl",
    "JORGE VELEZ BONIFAZ": "jorge.velez@spartan.cl",
    "FERNANDO SALAS MUÑOZ": "fernando.salas@spartan.cl",
    "BENJAMIN BELTRAN": "benjamin.beltran@spartan.cl",
    "WALTER GONZALEZ": "walter.gonzalez@spartan.cl",
    "ALVARO SILVA VERA": "alvaro.silva@spartan.cl",
    "PABLO CEMESKA": "pablo.cemeska@spartan.cl",
    "CLAUDIO BECERRA HERRERA": "claudio.becerra@spartan.cl",
    "PAULINA ALVAREZ": "paulina.alvarez@spartan.cl",
    "EDUARDO RIOS PACHECO": "Eduardo.rios@spartan.cl",
    "HC ANGELICA MARTINEZ HERNANDEZ": "angelica.martinez@spartan.cl",
    "ANGELICA MARTINEZ HERNANDEZ": "angelica.martinez@spartan.cl",
    "NELSON NORAMBUENA" : "nelson.norambuena@spartan.cl",
    "SERGIO ABASCAL" : "sergio.abascal@spartan.cl",
    "FB PIA RAMIREZ" : "pia.ramirez@spartan.cl",
    "IN HUGO SCHILLING" : "hugo.schilling@spartan.cl",
    "FABIAN ALE" : "fabian.ale@spartan.cl",
    "OSCAR ROJAS" : "oscar.rojas@spartan.cl",
    "ALVARO AHUMADA" : "alvaro.ahumada@spartan.cl",
    "OSCAR ORTIZ" : "oscar.ortiz@spartan.cl",
    "ROBERTO VENEGAS MUÑOZ" : "roberto.venegas@spartan.cl",
    "JUANI NOVOA" : "juani.novoa@spartan.cl",
    "EDMUNDO DE LA BARRA" : "edmundo.delabarra@spartan.cl",
    "HC HERNAN VENEGAS" : "hernan.venegas@spartan.cl",
    "MITCHEL MARTINEZ JARA":"mitchel.martinez@spartan.cl",
    "PEDRO ESCOBAR": "pedro.escobar@spartan.cl",
    "LEIZER MORGENSTERN":"leizer.morgenstern@spartan.cl"

  };

  const row = e.range.getRow();
  const col = e.range.getColumn();

  if (row === 1) return; // no tocar cabeceras

  if (col === NAME_COL) {
    const nombre = sheet.getRange(row, NAME_COL).getValue();
    const email = ejecutivos[nombre] || "";
    sheet.getRange(row, EMAIL_COL).setValue(email);
  }
}

/**
 * Rellenar todos los emails de una sola vez (optimizado)
 */
function rellenarEmailsOptimizado() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (sheet.getName() !== "NV") return;

  const NAME_COL = 8;
  const EMAIL_COL = 22  ;

  const ejecutivos = {
    "FB EDUARDO RIOS PACHECO": "eduardo.rios@spartan.cl",
    "IN ALEJANDRO BERRIOS": "alejandro.berrios@spartan.cl",
    "IN IGNACIO ZUÑIGA": "ignacio.zuniga@spartan.cl",
    "IN LUIS SALAZAR": "luis.salazar@spartan.cl",
    "GUSTAVO OLGUIN": "gustavo.olguin@spartan.cl",
    "HC IVES CAMOUSSEIGHT AVILES": "ives.camousseight@spartan.cl",
    "IVAN MARQUEZ MUÑOZ": "ivan.marquez@spartan.cl",
    "PABLO NOVELLA CUEVAS": "pablo.novella@spartan.cl",
    "HERNAN LOPEZ": "hernan.lopez@spartan.cl",
    "PABLO FUENTES ESPINOZA": "pablo.fuentes@spartan.cl",
    "JORGE VELEZ BONIFAZ": "jorge.velez@spartan.cl",
    "FERNANDO SALAS MUÑOZ": "fernando.salas@spartan.cl",
    "BENJAMIN BELTRAN": "benjamin.beltran@spartan.cl",
    "WALTER GONZALEZ": "walter.gonzalez@spartan.cl",
    "ALVARO SILVA VERA": "alvaro.silva@spartan.cl",
    "PABLO CEMESKA": "pablo.cemeska@spartan.cl",
    "CLAUDIO BECERRA HERRERA": "claudio.becerra@spartan.cl",
    "PAULINA ALVAREZ": "paulina.alvarez@spartan.cl",
    "EDUARDO RIOS PACHECO": "Eduardo.rios@spartan.cl",
    "HC ANGELICA MARTINEZ HERNANDEZ": "angelica.martinez@spartan.cl",
    "ANGELICA MARTINEZ HERNANDEZ": "angelica.martinez@spartan.cl",
    "NELSON NORAMBUENA" : "nelson.norambuena@spartan.cl",
    "SERGIO ABASCAL" : "sergio.abascal@spartan.cl",
    "FB PIA RAMIREZ" : "pia.ramirez@spartan.cl",
    "IN HUGO SCHILLING" : "hugo.schilling@spartan.cl",
    "FABIAN ALE" : "fabian.ale@spartan.cl",
    "OSCAR ROJAS" : "oscar.rojas@spartan.cl",
    "ALVARO AHUMADA" : "alvaro.ahumada@spartan.cl",
    "OSCAR ORTIZ" : "oscar.ortiz@spartan.cl",
    "ROBERTO VENEGAS MUÑOZ" : "roberto.venegas@spartan.cl",
    "JUANI NOVOA" : "juani.novoa@spartan.cl",
    "EDMUNDO DE LA BARRA" : "edmundo.delabarra@spartan.cl",
    "HC HERNAN VENEGAS" : "hernan.venegas@spartan.cl",
    "MITCHEL MARTINEZ JARA":"mitchel.martinez@spartan.cl",
    "PEDRO ESCOBAR": "pedro.escobar@spartan.cl",
    "LEIZER MORGENSTERN":"leizer.morgenstern@spartan.cl"

  };

  const lastRow = sheet.getLastRow();
  const names = sheet.getRange(2, NAME_COL, lastRow - 1, 1).getValues();
  const emails = sheet.getRange(2, EMAIL_COL, lastRow - 1, 1).getValues();

  for (let i = 0; i < names.length; i++) {
    const nombre = names[i][0];
    if (nombre && (!emails[i][0] || emails[i][0] === "")) {
      emails[i][0] = ejecutivos[nombre] || "";
    }
  }

  sheet.getRange(2, EMAIL_COL, lastRow - 1, 1).setValues(emails);
}

/**
 * Menú personalizado
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("⚙️ Herramientas Spartan")
    .addItem("➡ Completar Emails Optimizado", "rellenarEmailsOptimizado")
    .addToUi();
}


"use client";
import Link from "next/link";

export default function ComodatosMenu() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[#1f4ed8] mb-6">
        Gestión de Comodatos
      </h1>

      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">

        {/* Card: Evaluación de Negocio */}
        <Link
          href="/comodatos/negocios"
          className="group block rounded-2xl border bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#2B6CFF]">
              Evaluación de Negocio
            </h2>
            <span className="text-3xl">📈</span>
          </div>
          <p className="mt-2 text-sm text-zinc-600">
            Carga catálogo, arma la propuesta, calcula margen, comisión y genera PDF/Word.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-[#2B6CFF]">
            <span className="underline underline-offset-4">Ir al módulo</span>
            <svg
              className="h-4 w-4 transition group-hover:translate-x-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </div>
        </Link>

        {/* ✅ Nueva Card: Historial de Evaluaciones */}
        <Link
          href="/comodatos/evaluaciones/historial"
          className="group block rounded-2xl border bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#2B6CFF]">
              Historial de Evaluaciones
            </h2>
            <span className="text-3xl">🧾</span>
          </div>
          <p className="mt-2 text-sm text-zinc-600">
            Consulta las evaluaciones guardadas, revisa sus resultados y duplica propuestas anteriores.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-[#2B6CFF]">
            <span className="underline underline-offset-4">Ir al historial</span>
            <svg
              className="h-4 w-4 transition group-hover:translate-x-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </div>
        </Link>

        {/* Card: Clientes Comodatos Activos */}
        <Link
          href="/comodatos/clientes-activos"
          className="group block rounded-2xl border bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#2B6CFF]">
              Clientes Activos
            </h2>
            <span className="text-3xl">🧪</span>
          </div>
          <p className="mt-2 text-sm text-zinc-600">
            Lee ventas y comodatos vigentes (24m), calcula relación mensual y simula nuevas instalaciones.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-[#2B6CFF]">
            <span className="underline underline-offset-4">Ir al módulo</span>
            <svg
              className="h-4 w-4 transition group-hover:translate-x-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </div>
        </Link>

        {/* Card: Catálogo de Equipos */}
        <Link
          href="/comodatos/catalogos"
          className="group block rounded-2xl border bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#2B6CFF]">
              Catálogo de Equipos
            </h2>
            <span className="text-3xl">📚</span>
          </div>
          <p className="mt-2 text-sm text-zinc-600">
            Visualiza el catálogo (PDF) desde Google Drive con visor embebido.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-[#2B6CFF]">
            <span className="underline underline-offset-4">Ir al módulo</span>
            <svg
              className="h-4 w-4 transition group-hover:translate-x-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </div>
        </Link>

        {/* Card: Solicitud de Retiro de Equipos */}
        <Link
          href="/comodatos/solicitud-de-retiro"
          className="group block rounded-2xl border bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#2B6CFF]">
              Solicitud de Retiro
            </h2>
            <span className="text-3xl">📦</span>
          </div>
          <p className="mt-2 text-sm text-zinc-600">
            Crea una solicitud de retiro de equipos, selecciona comodatos históricos y envíala a Servicio Técnico.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-[#2B6CFF]">
            <span className="underline underline-offset-4">Ir al módulo</span>
            <svg
              className="h-4 w-4 transition group-hover:translate-x-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </div>
        </Link>

        {/* Card: Contrato de Comodato (Borrador) */}
        <Link
          href="/comodatos/contrato"
          className="group block rounded-2xl border bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#2B6CFF]">
              Contrato de Comodato (Borrador)
            </h2>
            <span className="text-3xl">📄</span>
          </div>
          <p className="mt-2 text-sm text-zinc-600">
            Visualiza el contrato tipo de comodato y descarga el borrador en PDF desde Google Drive.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-[#2B6CFF]">
            <span className="underline underline-offset-4">Ir al módulo</span>
            <svg
              className="h-4 w-4 transition group-hover:translate-x-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </div>
        </Link>

        {/* Card: Ficha Clientes Comodato */}
        <Link
          href="/comodatos/ficha-clientes"
          className="group block rounded-2xl border bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#2B6CFF]">
              Ficha Clientes Comodato
            </h2>
            <span className="text-3xl">📘</span>
          </div>
          <p className="mt-2 text-sm text-zinc-600">
            Consulta la base de clientes activos con comodato y descarga el Excel desde Google Sheets.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-[#2B6CFF]">
            <span className="underline underline-offset-4">Ir al módulo</span>
            <svg
              className="h-4 w-4 transition group-hover:translate-x-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </div>
        </Link>

      </div>
    </div>
  );
}
