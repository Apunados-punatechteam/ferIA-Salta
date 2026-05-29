import { type FormEvent, useState } from "react";
import { backendCreateFair } from "../services/backendApi";
import { MapPointPicker } from "./MapPointPicker";

type OrganizerFairForm = {
  name: string;
  description: string;
  address: string;
  city: string;
  category: string;
  startDate: string;
  endDate: string;
  availableSlots: number;
  latitude: number;
  longitude: number;
};

const initialForm: OrganizerFairForm = {
  name: "Feria Emprende Salta",
  description: "Feria creada por un feriante y enviada a aprobación municipal.",
  address: "Plaza 9 de Julio, Salta",
  city: "Salta",
  category: "artesanias",
  startDate: "2026-07-10",
  endDate: "2026-07-11",
  availableSlots: 25,
  latitude: -24.7883,
  longitude: -65.4106,
};

function formatCoordinate(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return value.toFixed(6);
}

export function FairOrganizerPanel({
  token,
  onCreated,
}: {
  token: string | null;
  onCreated: () => Promise<void> | void;
}) {
  const [form, setForm] = useState<OrganizerFairForm>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastCreated, setLastCreated] = useState<{
    entityKey: string;
    txHash?: string;
    latitude: number;
    longitude: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      alert("No hay token de sesión. Cerrá sesión y volvé a ingresar.");
      return;
    }

    if (!form.name.trim()) {
      alert("Ingresá el nombre de la feria.");
      return;
    }

    if (!form.address.trim()) {
      alert("Ingresá la dirección de la feria.");
      return;
    }

    if (!Number.isFinite(form.latitude) || !Number.isFinite(form.longitude)) {
      alert("Seleccioná un punto válido en el mapa.");
      return;
    }

    if (form.availableSlots <= 0) {
      alert("Los cupos deben ser mayores a cero.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const created = await backendCreateFair({
        token,
        fair: form,
      });

      setLastCreated({
        entityKey: created.entityKey,
        txHash: created.txHash,
        latitude: form.latitude,
        longitude: form.longitude,
      });

      await onCreated();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido al crear feria.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="grid-layout">
      <div className="panel form-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Feriante</p>
            <h2>Crear feria para aprobación municipal</h2>
          </div>
          <span className="status-pill">Mapa editable</span>
        </div>

        <p className="empty-state">
          Cargá los datos de la feria y marcá el punto exacto en el mapa. El
          backend firma la operación y guarda la entidad fair_event en Arkiv con
          estado pending.
        </p>

        {errorMessage && <div className="error-banner">{errorMessage}</div>}

        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Nombre de la feria
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </label>

          <label>
            Rubro
            <select
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({ ...current, category: event.target.value }))
              }
            >
              <option value="artesanias">Artesanías</option>
              <option value="gastronomia">Gastronomía</option>
              <option value="textil">Textil</option>
              <option value="regional">Productos regionales</option>
              <option value="servicios">Servicios</option>
            </select>
          </label>

          <label className="span-2">
            Descripción
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </label>

          <label>
            Dirección
            <input
              value={form.address}
              onChange={(event) =>
                setForm((current) => ({ ...current, address: event.target.value }))
              }
              placeholder="Ej: Plaza 9 de Julio, Salta"
            />
          </label>

          <label>
            Ciudad
            <input
              value={form.city}
              onChange={(event) =>
                setForm((current) => ({ ...current, city: event.target.value }))
              }
            />
          </label>

          <label>
            Fecha desde
            <input
              type="date"
              value={form.startDate}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  startDate: event.target.value,
                }))
              }
            />
          </label>

          <label>
            Fecha hasta
            <input
              type="date"
              value={form.endDate}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  endDate: event.target.value,
                }))
              }
            />
          </label>

          <label>
            Cupos
            <input
              type="number"
              min={1}
              value={form.availableSlots}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  availableSlots: Number(event.target.value),
                }))
              }
            />
          </label>

          <div className="coordinate-preview">
            <span>Latitud</span>
            <strong>{formatCoordinate(form.latitude)}</strong>
          </div>

          <div className="coordinate-preview">
            <span>Longitud</span>
            <strong>{formatCoordinate(form.longitude)}</strong>
          </div>

          <div className="span-2">
            <MapPointPicker
              latitude={form.latitude}
              longitude={form.longitude}
              onChange={(point) =>
                setForm((current) => ({
                  ...current,
                  latitude: point.latitude,
                  longitude: point.longitude,
                }))
              }
            />
          </div>

          <div className="actions span-2">
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creando..." : "Crear feria en Arkiv"}
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Resultado</p>
            <h2>Feria enviada a aprobación</h2>
          </div>
        </div>

        {!lastCreated ? (
          <p className="empty-state">
            Todavía no creaste una feria desde el backend productivo.
          </p>
        ) : (
          <div className="result-stack">
            <div className="result-item">
              <span>fair_event</span>
              <strong>{lastCreated.entityKey}</strong>
            </div>

            {lastCreated.txHash && (
              <div className="result-item">
                <span>txHash</span>
                <strong>{lastCreated.txHash}</strong>
              </div>
            )}

            <div className="result-item">
              <span>Ubicación guardada</span>
              <strong>
                {formatCoordinate(lastCreated.latitude)},{" "}
                {formatCoordinate(lastCreated.longitude)}
              </strong>
            </div>

            <p className="empty-state">
              Estado inicial: pending. La municipalidad debe aprobar la feria
              antes de que aparezca como feria disponible para emprendedores.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}