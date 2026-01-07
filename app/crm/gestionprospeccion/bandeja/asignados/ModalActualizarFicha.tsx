'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Prospecto {
  folio: string;
  nombre_razon_social?: string;
  rut?: string;
  contacto?: string;
  telefono?: string;
  correo?: string;
  direccion?: string;
  rubro?: string;
  monto_proyectado?: string;
  fecha_cierre?: string;
  probabilidad_cierre?: string;
  etapa?: string;
  observacion?: string;
}

interface ModalActualizarFichaProps {
  abierto: boolean;
  onCerrar: () => void;
  prospecto: Prospecto;
  onGuardado: () => void;
  loggedEmail: string;
}

export default function ModalActualizarFicha({
  abierto,
  onCerrar,
  prospecto,
  onGuardado,
  loggedEmail,
}: ModalActualizarFichaProps) {
  const [form, setForm] = useState<Prospecto>(prospecto);
  const [saving, setSaving] = useState(false);

  /** 🔁 cuando cambia el prospecto activo */
  useEffect(() => {
    setForm(prospecto);
  }, [prospecto]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const guardar = async () => {
    if (!form.folio) {
      toast.error('Folio no válido');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        folio: form.folio,

        // 🔹 datos editables
        nombre_razon_social: form.nombre_razon_social,
        rut: form.rut,
        contacto: form.contacto,
        telefono: form.telefono,
        correo: form.correo,
        direccion: form.direccion,
        rubro: form.rubro,
        monto_proyectado: form.monto_proyectado,
        observacion: form.observacion,

        // 🔹 control
        asignado_a: loggedEmail,
        updated_by: loggedEmail,
      };

      const res = await fetch('/api/crm/prospectos/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || 'Error al guardar');
      }

      toast.success('Datos del prospecto actualizados');
      onGuardado(); // 🔄 refresca tabla
      onCerrar();   // ❌ cierra modal
    } catch (err: any) {
      toast.error(err.message || 'Error inesperado');
    } finally {
      setSaving(false);
    }
  };

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-2">Actualizar ficha</h2>
        <p className="text-sm text-gray-500 mb-4">
          Folio: <strong>{form.folio}</strong>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input name="nombre_razon_social" value={form.nombre_razon_social || ''} onChange={handleChange} placeholder="Razón social" className="border p-2 rounded" />
          <input name="rut" value={form.rut || ''} onChange={handleChange} placeholder="RUT" className="border p-2 rounded" />
          <input name="contacto" value={form.contacto || ''} onChange={handleChange} placeholder="Contacto" className="border p-2 rounded" />
          <input name="telefono" value={form.telefono || ''} onChange={handleChange} placeholder="Teléfono" className="border p-2 rounded" />
          <input name="correo" value={form.correo || ''} onChange={handleChange} placeholder="Correo" className="border p-2 rounded" />
          <input name="direccion" value={form.direccion || ''} onChange={handleChange} placeholder="Dirección" className="border p-2 rounded col-span-1 md:col-span-2" />
          <input name="rubro" value={form.rubro || ''} onChange={handleChange} placeholder="Rubro" className="border p-2 rounded" />
          <input name="monto_proyectado" value={form.monto_proyectado || ''} onChange={handleChange} placeholder="Monto proyectado" className="border p-2 rounded" />
          <textarea name="observacion" value={form.observacion || ''} onChange={handleChange} placeholder="Observación" className="border p-2 rounded col-span-1 md:col-span-2" />
        </div>

        <div className="mt-6 flex justify-between">
          <button onClick={onCerrar} className="bg-gray-200 px-4 py-2 rounded">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={saving}
            className="bg-black text-white px-4 py-2 rounded font-bold"
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
