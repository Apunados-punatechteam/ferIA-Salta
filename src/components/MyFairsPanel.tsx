import { type FormEvent, useMemo, useState } from "react";
import { backendDeleteFair, backendUpdateFair } from "../services/backendApi";
import type { EntityRecord } from "../types/feria";

type FairPayload = {
  name?: string;
  description?: string;
  address?: string;
  city?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  availableSlots?: number;
  latitude?: number;
  longitude?: number;
  status?: string;
  createdByDocument?: string;
};

type EditForm = {
  name: string;
  description: string;
  address: string;
  city: string;
  category: string;
  startDate: string;
  endDate: string;
  availableSlots: number;
};

function entityType(entity: EntityRecord<unknown>) {
  return entity.attributes.find((item) => item.key === "entityType")?.value;
}

export function MyFairsPanel({
  token,
  entities,
  userId,
  onChanged,
}: {
  token: string | null;
  entities: EntityRecord<unknown>[];
  userId: string;
  onChanged: () => Promise<void> | void;
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const approvedKeys = useMemo(() => {
    const latest = new Map<string, { decision?: string; decidedAt: number }>();

    for (const entity of entities) {
      if (entityType(entity) !== "fair_event_decision") continue;
      const payload = entity.payload as {
        fairKey?: string;
        decision?: string;
        decidedAt?: number;
      };
      if (!payload.fairKey) continue;
      const decidedAt = payload.decidedAt ?? 0;
      const current = latest.get(payload.fairKey);
      if (!current || decidedAt >= current.decidedAt) {
        latest.set(payload.fairKey, { decision: payload.decision, decidedAt });
      }
    }

    return new Set(
      [...latest.entries()]
        .filter(([, value]) => value.decision === "approved")
        .map(([key]) => key)
    );
  }, [entities]);

  const myFairs = useMemo(
    () =>
      entities
        .filter((entity) => entityType(entity) === "fair_event")
        .map((entity) => entity as EntityRecord<FairPayload>)
        .filter((entity) => entity.payload.createdByDocument === userId)
        .sort((a, b) => b.createdAt - a.createdAt),
    [entities, userId]
  );

  function startEdit(fair: EntityRecord<FairPayload>) {
    const p = fair.payload;
    setEditingKey(fair.entityKey);
    setErrorMessage("");
    setSuccessMessage("");
    setForm({
      name: p.name ?? "",
      description: p.description ?? "",
      address: p.address ?? "",
      city: p.city ?? "",
      category: p.category ?? "",
      startDate: p.startDate ?? "",
      endDate: p.endDate ?? "",
      availableSlots: p.availableSlots ?? 1,
    });
  }

  function cancelEdit() {
    setEditingKey(null);
    setForm(null);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>, fair: EntityRecord<FairPayload>) {
    event.preventDefault();
    if (!token || !form) return;

    setBusy(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await backendUpdateFair({
        token,
        fairKey: fair.entityKey,
        fair: {
          ...form,
          latitude: fair.payload.latitude ?? 0,
          longitude: fair.payload.longitude ?? 0,
        },
      });
      setSuccessMessage(`Feria "${form.name}" actualizada.`);
      cancelEdit();
      await onChanged();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo guardar la feria.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(fair: EntityRecord<FairPayload>) {
    if (!token) return;

    const confirmed = window.confirm(
      `¿Borrar la feria "${fair.payload.name}"? También se borrarán sus inscripciones y decisiones. Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    setBusy(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await backendDeleteFair({ token, fairKey: fair.entityKey });
      setSuccessMessage(`Feria "${fair.payload.name}" borrada.`);
      await onChanged();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo borrar la feria.");
    } finally {
      setBusy(false);
    }
  }

  function field(label: string, key: keyof EditForm, type = "text") {
    return (
      <label>
        {label}
        <input
          type={type}
          value={form?.[key] ?? ""}
          min={type === "number" ? 1 : undefined}
          onChange={(e) =>
            setForm((current) =>
              current
                ? { ...current, [key]: type === "number" ? Number(e.target.value) : e.target.value }
                : current
            )
          }
        />
      </label>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Feriante</p>
          <h2>Mis ferias</h2>
        </div>
        <span className="status-pill">{myFairs.length} ferias</span>
      </div>

      {errorMessage && <div className="error-banner">{errorMessage}</div>}
      {successMessage && <div className="success-banner">{successMessage}</div>}

      {myFairs.length === 0 ? (
        <p className="empty-state">Todavía no creaste ninguna feria.</p>
      ) : (
        <div className="entity-list">
          {myFairs.map((fair) => {
            const p = fair.payload;
            const isApproved = approvedKeys.has(fair.entityKey);
            const isEditing = editingKey === fair.entityKey && form;

            return (
              <article className="entity-card" key={fair.entityKey}>
                {isEditing ? (
                  <form className="form-grid" onSubmit={(e) => void handleSave(e, fair)}>
                    {field("Nombre", "name")}
                    {field("Categoría", "category")}
                    {field("Dirección", "address")}
                    {field("Ciudad", "city")}
                    {field("Inicio", "startDate", "date")}
                    {field("Fin", "endDate", "date")}
                    {field("Cupos", "availableSlots", "number")}
                    <label className="span-2">
                      Descripción
                      <textarea
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                      />
                    </label>
                    <div className="actions span-2">
                      <button type="submit" disabled={busy}>
                        {busy ? "Guardando..." : "Guardar cambios"}
                      </button>
                      <button type="button" className="ghost" onClick={cancelEdit} disabled={busy}>
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <h3>{p.name}</h3>
                    <p>
                      {p.address} · {p.city} · {p.category}
                    </p>
                    <p>
                      {p.startDate} → {p.endDate} · {p.availableSlots} cupos ·{" "}
                      <span className="status-pill">{isApproved ? "aprobada" : (p.status ?? "pending")}</span>
                    </p>
                    <div className="actions">
                      <button type="button" className="secondary" onClick={() => startEdit(fair)} disabled={busy}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => void handleDelete(fair)}
                        disabled={busy || isApproved}
                        title={isApproved ? "Una feria aprobada por el gobierno no se puede borrar" : undefined}
                      >
                        Borrar
                      </button>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
