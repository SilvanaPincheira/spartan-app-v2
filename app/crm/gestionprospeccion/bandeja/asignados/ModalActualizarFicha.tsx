'use client';

import React, { useState } from 'react';
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
}: ModalActualizarFichaProps) {
  const [form, setForm] = useState<Prospecto>({ ...prospecto });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const guardar = async () => {
    const payload = {
      ...form,
      etapa: 'Contactado',
    };

    const res = await fetch('/api/crm/prospectos/update', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (res.ok) {
      toast.success('Prospecto actualizado correctamente');
      onGuardado(); // actualiza la vista
      onCerrar();   // cierra modal
    } else {
      toast.error('Error al guardar: ' + (data.error || ''));
    }
  };

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg w-full max-w-4xl overflow-y-auto max-h-[90vh]">
        <h2 className="text-lg font-bold mb-2">Completar ficha (para CONTACTADO)</h2>
        <p className="text-sm text-gray-500 mb-4">
          Folio: <strong>{form.folio}</strong>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            name="nombre_razon_social"
            value={form.nombre_razon_social || ''}
            onChange={handleChange}
            placeholder="Razón social"
            className="border p-2 rounded"
          />
          <input
            name="rut"
            value={form.rut || ''}
            onChange={handleChange}
            placeholder="RUT"
            className="border p-2 rounded"
          />
          <input
            name="telefono"
            value={form.telefono || ''}
            onChange={handleChange}
            placeholder="Teléfono"
            className="border p-2 rounded"
          />
          <input
            name="correo"
            value={form.correo || ''}
            onChange={handleChange}
            placeholder="Correo"
            className="border p-2 rounded"
          />
          <input
            name="direccion"
            value={form.direccion || ''}
            onChange={handleChange}
            placeholder="Dirección"
            className="border p-2 rounded"
          />
          <input
            name="rubro"
            value={form.rubro || ''}
            onChange={handleChange}
            placeholder="Rubro"
            className="border p-2 rounded"
          />
          <input
            name="monto_proyectado"
            value={form.monto_proyectado || ''}
            onChange={handleChange}
            placeholder="Monto proyectado"
            className="border p-2 rounded"
          />
          <select
            name="fecha_cierre"
            value={form.fecha_cierre || ''}
            onChange={handleChange}
            className="border p-2 rounded"
          >
            <option value="">Fecha cierre</option>
            <option>Antes 30 días</option>
            <option>Entre 30 y 60 días</option>
            <option>Más de 60 días</option>
          </select>
          <select
            name="probabilidad_cierre"
            value={form.probabilidad_cierre || ''}
            onChange={handleChange}
            className="border p-2 rounded"
          >
            <option value="">Prob. cierre</option>
            <option>Menor a 30%</option>
            <option>Entre 30 y 50%</option>
            <option>Mayor a 50%</option>
          </select>
          <textarea
            name="observacion"
            value={form.observacion || ''}
            onChange={handleChange}
            placeholder="Observación"
            className="border p-2 rounded col-span-1 md:col-span-2"
          />
        </div>

        <div className="mt-4 flex justify-between">
          <button
            onClick={onCerrar}
            className="bg-gray-200 px-4 py-2 rounded"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            className="bg-black text-white px-4 py-2 rounded"
          >
            Guardar y pasar a CONTACTADO
          </button>
        </div>
      </div>
    </div>
  );
}
