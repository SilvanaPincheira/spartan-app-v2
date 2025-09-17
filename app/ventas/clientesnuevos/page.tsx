"use client";

import React, { useState } from "react";

type ClienteNuevo = {
  razonSocial: string;
  rut: string;
  nombreFantasia: string;
  giro: string;
  direccion: string;
  comuna: string;
  region: string;
  telefono: string;
  email: string;
  contactoComercial: string;
  emailComercial: string;
  telefonoComercial: string;
  contactoRecepcion: string;
  emailRecepcion: string;
  telefonoRecepcion: string;
  contactoFinanzas: string;
  emailFinanzas: string;
  telefonoFinanzas: string;
  contactoPagos: string;
  emailPagos: string;
  telefonoPagos: string;
  direccionDespacho: string;
  ciudad: string;
  tipoDocumento: string;
  banco: string;
  cuentaCorriente: string;
  representanteLegal: string;
  contribuyenteElectronico: string;
  rubro: string;
  condicionPago: string;
  cobrador: string;
  analisisCredito: string;
  comentarios: string;
};

export default function ClientesNuevosPage() {
  const [form, setForm] = useState<ClienteNuevo>({
    razonSocial: "",
    rut: "",
    nombreFantasia: "",
    giro: "",
    direccion: "",
    comuna: "",
    region: "",
    telefono: "",
    email: "",
    contactoComercial: "",
    emailComercial: "",
    telefonoComercial: "",
    contactoRecepcion: "",
    emailRecepcion: "",
    telefonoRecepcion: "",
    contactoFinanzas: "",
    emailFinanzas: "",
    telefonoFinanzas: "",
    contactoPagos: "",
    emailPagos: "",
    telefonoPagos: "",
    direccionDespacho: "",
    ciudad: "",
    tipoDocumento: "",
    banco: "",
    cuentaCorriente: "",
    representanteLegal: "",
    contribuyenteElectronico: "",
    rubro: "",
    condicionPago: "",
    cobrador: "",
    analisisCredito: "",
    comentarios: "",
  });

  const [mensaje, setMensaje] = useState<string>("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleGuardar() {
    try {
      setMensaje("⏳ Guardando...");
      const res = await fetch("/api/save-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const json = await res.json();
      if (json.ok || json.status === "ok") {
        setMensaje("✅ Cliente guardado en Google Sheets");
        setForm({
          razonSocial: "",
          rut: "",
          nombreFantasia: "",
          giro: "",
          direccion: "",
          comuna: "",
          region: "",
          telefono: "",
          email: "",
          contactoComercial: "",
          emailComercial: "",
          telefonoComercial: "",
          contactoRecepcion: "",
          emailRecepcion: "",
          telefonoRecepcion: "",
          contactoFinanzas: "",
          emailFinanzas: "",
          telefonoFinanzas: "",
          contactoPagos: "",
          emailPagos: "",
          telefonoPagos: "",
          direccionDespacho: "",
          ciudad: "",
          tipoDocumento: "",
          banco: "",
          cuentaCorriente: "",
          representanteLegal: "",
          contribuyenteElectronico: "",
          rubro: "",
          condicionPago: "",
          cobrador: "",
          analisisCredito: "",
          comentarios: "",
        });
      } else {
        setMensaje("❌ Error: " + (json.error || "No se pudo guardar"));
      }
    } catch (e: any) {
      setMensaje("❌ Error al conectar: " + e.message);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <h1 className="text-2xl font-bold text-[#2B6CFF] mb-6">👤 Ficha de Cliente Nuevo</h1>

      {mensaje && (
        <div className="mb-4 text-sm">
          {mensaje}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-6 rounded shadow">
        {/* Datos Generales */}
        <input name="razonSocial" value={form.razonSocial} onChange={handleChange} placeholder="Razón Social" className="border p-2 rounded" />
        <input name="rut" value={form.rut} onChange={handleChange} placeholder="RUT" className="border p-2 rounded" />
        <input name="nombreFantasia" value={form.nombreFantasia} onChange={handleChange} placeholder="Nombre de Fantasía" className="border p-2 rounded" />
        <input name="giro" value={form.giro} onChange={handleChange} placeholder="Giro" className="border p-2 rounded" />
        <input name="direccion" value={form.direccion} onChange={handleChange} placeholder="Dirección" className="border p-2 rounded" />
        <input name="comuna" value={form.comuna} onChange={handleChange} placeholder="Comuna" className="border p-2 rounded" />
        <input name="region" value={form.region} onChange={handleChange} placeholder="Región" className="border p-2 rounded" />
        <input name="telefono" value={form.telefono} onChange={handleChange} placeholder="Teléfono" className="border p-2 rounded" />
        <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="Email" className="border p-2 rounded" />

        {/* Contactos */}
        <input name="contactoComercial" value={form.contactoComercial} onChange={handleChange} placeholder="Contacto Comercial" className="border p-2 rounded" />
        <input name="emailComercial" value={form.emailComercial} onChange={handleChange} placeholder="Email Comercial" className="border p-2 rounded" />
        <input name="telefonoComercial" value={form.telefonoComercial} onChange={handleChange} placeholder="Teléfono Comercial" className="border p-2 rounded" />

        <input name="contactoRecepcion" value={form.contactoRecepcion} onChange={handleChange} placeholder="Contacto Recepción Pedidos" className="border p-2 rounded" />
        <input name="emailRecepcion" value={form.emailRecepcion} onChange={handleChange} placeholder="Email Recepción" className="border p-2 rounded" />
        <input name="telefonoRecepcion" value={form.telefonoRecepcion} onChange={handleChange} placeholder="Teléfono Recepción" className="border p-2 rounded" />

        <input name="contactoFinanzas" value={form.contactoFinanzas} onChange={handleChange} placeholder="Contacto Finanzas" className="border p-2 rounded" />
        <input name="emailFinanzas" value={form.emailFinanzas} onChange={handleChange} placeholder="Email Finanzas" className="border p-2 rounded" />
        <input name="telefonoFinanzas" value={form.telefonoFinanzas} onChange={handleChange} placeholder="Teléfono Finanzas" className="border p-2 rounded" />

        <input name="contactoPagos" value={form.contactoPagos} onChange={handleChange} placeholder="Contacto Pagos" className="border p-2 rounded" />
        <input name="emailPagos" value={form.emailPagos} onChange={handleChange} placeholder="Email Pagos" className="border p-2 rounded" />
        <input name="telefonoPagos" value={form.telefonoPagos} onChange={handleChange} placeholder="Teléfono Pagos" className="border p-2 rounded" />

        {/* Despacho */}
        <input name="direccionDespacho" value={form.direccionDespacho} onChange={handleChange} placeholder="Dirección de Despacho" className="border p-2 rounded" />
        <input name="ciudad" value={form.ciudad} onChange={handleChange} placeholder="Ciudad" className="border p-2 rounded" />
        <select name="tipoDocumento" value={form.tipoDocumento} onChange={handleChange} className="border p-2 rounded">
          <option value="">Tipo Documento</option>
          <option value="Factura">Factura</option>
          <option value="Guía">Guía</option>
        </select>

        {/* Financieros */}
        <input name="banco" value={form.banco} onChange={handleChange} placeholder="Banco" className="border p-2 rounded" />
        <input name="cuentaCorriente" value={form.cuentaCorriente} onChange={handleChange} placeholder="Cuenta Corriente" className="border p-2 rounded" />
        <input name="representanteLegal" value={form.representanteLegal} onChange={handleChange} placeholder="Representante Legal" className="border p-2 rounded" />
        <select name="contribuyenteElectronico" value={form.contribuyenteElectronico} onChange={handleChange} className="border p-2 rounded">
          <option value="">Contribuyente Electrónico</option>
          <option value="Sí">Sí</option>
          <option value="No">No</option>
        </select>

        {/* Internos */}
        <input name="rubro" value={form.rubro} onChange={handleChange} placeholder="Rubro" className="border p-2 rounded" />
        <input name="condicionPago" value={form.condicionPago} onChange={handleChange} placeholder="Condición de Pago" className="border p-2 rounded" />
        <input name="cobrador" value={form.cobrador} onChange={handleChange} placeholder="Cobrador Asignado" className="border p-2 rounded" />
        <input name="analisisCredito" value={form.analisisCredito} onChange={handleChange} placeholder="Análisis Crédito" className="border p-2 rounded" />

        <textarea name="comentarios" value={form.comentarios} onChange={handleChange} placeholder="Comentarios" className="border p-2 rounded md:col-span-2" />
      </div>

      <div className="mt-6 flex gap-2">
        <button
          onClick={handleGuardar}
          className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700"
        >
          💾 Guardar
        </button>
        <button
          onClick={() => setForm({
            razonSocial: "",
            rut: "",
            nombreFantasia: "",
            giro: "",
            direccion: "",
            comuna: "",
            region: "",
            telefono: "",
            email: "",
            contactoComercial: "",
            emailComercial: "",
            telefonoComercial: "",
            contactoRecepcion: "",
            emailRecepcion: "",
            telefonoRecepcion: "",
            contactoFinanzas: "",
            emailFinanzas: "",
            telefonoFinanzas: "",
            contactoPagos: "",
            emailPagos: "",
            telefonoPagos: "",
            direccionDespacho: "",
            ciudad: "",
            tipoDocumento: "",
            banco: "",
            cuentaCorriente: "",
            representanteLegal: "",
            contribuyenteElectronico: "",
            rubro: "",
            condicionPago: "",
            cobrador: "",
            analisisCredito: "",
            comentarios: "",
          })}
          className="bg-zinc-300 px-4 py-2 rounded hover:bg-zinc-400"
        >
          🧹 Limpiar
        </button>
      </div>
    </div>
  );
}
