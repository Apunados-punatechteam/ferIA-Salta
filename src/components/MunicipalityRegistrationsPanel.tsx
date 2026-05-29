import { useMemo, useState } from "react";
import { SafeTabs } from "./SafeTabs";
import { backendCancelFairRegistration } from "../services/backendApi";
import type { LocalArkivEntity } from "../types/feria";

type FairPayload = {
  name?: string;
  address?: string;
  category?: string;
  availableSlots?: number;
};

type DecisionPayload = {
  fairKey?: string;
  decision?: string;
  decidedAt?: number;
};

type RegistrationPayload = {
  fairKey?: string;
  fairName?: string;
  fairAddress?: string;
  fairCategory?: string;
  entrepreneurName?: string;
  entrepreneurDocument?: string;
  businessName?: string;
  phone?: string;
  description?: string;
  standPhotoUrl?: string;
  articlePhotoUrls?: string[];
  status?: string;
  registeredAt?: number;
};

type CancellationPayload = {
  fairKey?: string;
  registrationKey?: string;
  notes?: string;
  cancelledAt?: number;
};

function getEntityType(entity: LocalArkivEntity<unknown>): string {
  const attr = entity.attributes.find((item) => item.key === "entityType");
  return String(attr?.value ?? "unknown");
}

function getPayload<TPayload>(entity: LocalArkivEntity<unknown>): TPayload {
  if (entity.payload && typeof entity.payload === "object") {
    return entity.payload as TPayload;
  }

  return {} as TPayload;
}

function formatDate(timestamp?: number): string {
  if (!timestamp) return "-";

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function getLatestDecisionByFairKey(entities: LocalArkivEntity<unknown>[]) {
  const decisions = entities
    .filter((entity) => getEntityType(entity) === "fair_event_decision")
    .map((entity) => {
      const payload = getPayload<DecisionPayload>(entity);

      return {
        fairKey: String(payload.fairKey ?? ""),
        decision: String(payload.decision ?? ""),
        decidedAt: Number(payload.decidedAt ?? entity.createdAt),
      };
    })
    .filter((item) => item.fairKey && item.decision)
    .sort((a, b) => b.decidedAt - a.decidedAt);

  const map = new Map<string, (typeof decisions)[number]>();

  for (const decision of decisions) {
    if (!map.has(decision.fairKey)) {
      map.set(decision.fairKey, decision);
    }
  }

  return map;
}

function getApprovedFairs(entities: LocalArkivEntity<unknown>[]) {
  const latestDecisionByFairKey = getLatestDecisionByFairKey(entities);

  return entities
    .filter((entity) => {
      if (getEntityType(entity) !== "fair_event") return false;

      const latestDecision = latestDecisionByFairKey.get(entity.entityKey);
      return latestDecision?.decision === "approved";
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

function getCancellationMap(entities: LocalArkivEntity<unknown>[]) {
  const map = new Map<string, LocalArkivEntity<unknown>>();

  for (const entity of entities) {
    if (getEntityType(entity) !== "fair_registration_cancellation") continue;

    const payload = getPayload<CancellationPayload>(entity);
    const registrationKey = String(payload.registrationKey ?? "");

    if (registrationKey) {
      map.set(registrationKey, entity);
    }
  }

  return map;
}

function getActiveRegistrationCount(
  registrations: Array<{
    entity: LocalArkivEntity<unknown>;
    payload: RegistrationPayload;
    isCancelled: boolean;
  }>,
  fairKey: string
) {
  return registrations.filter(
    (item) =>
      !item.isCancelled &&
      String(item.payload.fairKey ?? "") === fairKey &&
      String(item.payload.status ?? "active") === "active"
  ).length;
}

export function MunicipalityRegistrationsPanel({
  token,
  entities,
  onCancelled,
}: {
  token: string | null;
  entities: LocalArkivEntity<unknown>[];
  onCancelled: () => Promise<void> | void;
}) {
  const [selectedFairKey, setSelectedFairKey] = useState("");
  const [notesByRegistrationKey, setNotesByRegistrationKey] = useState<
    Record<string, string>
  >({});
  const [processingRegistrationKey, setProcessingRegistrationKey] =
    useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const approvedFairs = useMemo(() => getApprovedFairs(entities), [entities]);
  const cancellationMap = useMemo(() => getCancellationMap(entities), [entities]);

  const selectedFair = useMemo(() => {
    return (
      approvedFairs.find((fair) => fair.entityKey === selectedFairKey) ??
      approvedFairs[0] ??
      null
    );
  }, [approvedFairs, selectedFairKey]);

  const selectedFairPayload = selectedFair
    ? getPayload<FairPayload>(selectedFair)
    : null;

  const registrations = useMemo(() => {
    return entities
      .filter((entity) => getEntityType(entity) === "fair_registration")
      .map((entity) => {
        const payload = getPayload<RegistrationPayload>(entity);
        const cancellation = cancellationMap.get(entity.entityKey);

        return {
          entity,
          payload,
          cancellation,
          isCancelled: Boolean(cancellation),
        };
      })
      .sort((a, b) => b.entity.createdAt - a.entity.createdAt);
  }, [entities, cancellationMap]);

  const selectedFairRegistrations = selectedFair
    ? registrations.filter(
        (item) => String(item.payload.fairKey ?? "") === selectedFair.entityKey
      )
    : [];

  const activeRegistrations = selectedFairRegistrations.filter(
    (item) => !item.isCancelled
  );

  const cancelledRegistrations = selectedFairRegistrations.filter(
    (item) => item.isCancelled
  );

  const selectedFairSlots = Number(selectedFairPayload?.availableSlots ?? 0);
  const selectedFairActiveCount = selectedFair
    ? getActiveRegistrationCount(registrations, selectedFair.entityKey)
    : 0;
  const selectedFairRemainingSlots = Math.max(
    selectedFairSlots - selectedFairActiveCount,
    0
  );

  async function cancelRegistration(item: {
    entity: LocalArkivEntity<unknown>;
    payload: RegistrationPayload;
  }) {
    if (!token) {
      alert("No hay token de sesion. Inicia sesion de nuevo.");
      return;
    }

    if (!selectedFair) {
      alert("Primero selecciona una feria aprobada.");
      return;
    }

    const fairKey = String(item.payload.fairKey ?? "");
    const registrationKey = item.entity.entityKey;

    if (fairKey !== selectedFair.entityKey) {
      alert("La inscripcion no corresponde a la feria seleccionada.");
      return;
    }

    if (!fairKey || !registrationKey) {
      alert("No se pudo identificar la feria o la inscripcion.");
      return;
    }

    const notes =
      notesByRegistrationKey[registrationKey]?.trim() ||
      "Baja municipal. Se libera cupo.";

    const confirmed = window.confirm(
      "Confirmar baja de esta inscripcion? Esta accion libera un cupo de la feria seleccionada."
    );

    if (!confirmed) return;

    setProcessingRegistrationKey(registrationKey);
    setErrorMessage("");

    try {
      await backendCancelFairRegistration({
        token,
        fairKey,
        registrationKey,
        notes,
      });

      await onCancelled();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo dar de baja la inscripcion.";

      setErrorMessage(message);
    } finally {
      setProcessingRegistrationKey(null);
    }
  }

  function renderFairSelector() {
    if (approvedFairs.length === 0) {
      return (
        <p className="empty-state">
          No hay ferias aprobadas. Sincroniza desde backend o aprueba una feria.
        </p>
      );
    }

    return (
      <div className="fair-filter-box">
        <label>
          Feria aprobada
          <select
            value={selectedFair?.entityKey ?? ""}
            onChange={(event) => setSelectedFairKey(event.target.value)}
          >
            {approvedFairs.map((fair) => {
              const payload = getPayload<FairPayload>(fair);
              const active = getActiveRegistrationCount(registrations, fair.entityKey);
              const total = Number(payload.availableSlots ?? 0);
              const remaining = Math.max(total - active, 0);

              return (
                <option value={fair.entityKey} key={fair.entityKey}>
                  {String(payload.name ?? "Feria")} - {active} activos - {remaining} cupos libres
                </option>
              );
            })}
          </select>
        </label>

        {selectedFair && (
          <div className="fair-filter-summary">
            <div>
              <span>Feria seleccionada</span>
              <strong>{selectedFairPayload?.name ?? "Feria"}</strong>
            </div>

            <div>
              <span>Direccion</span>
              <strong>{selectedFairPayload?.address ?? "-"}</strong>
            </div>

            <div>
              <span>Rubro</span>
              <strong>{selectedFairPayload?.category ?? "-"}</strong>
            </div>

            <div>
              <span>Cupos</span>
              <strong>
                {selectedFairActiveCount} usados / {selectedFairRemainingSlots} libres / {selectedFairSlots} total
              </strong>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderRegistrationCard(item: {
    entity: LocalArkivEntity<unknown>;
    payload: RegistrationPayload;
    cancellation?: LocalArkivEntity<unknown>;
    isCancelled: boolean;
  }) {
    const cancellationPayload = item.cancellation
      ? getPayload<CancellationPayload>(item.cancellation)
      : null;

    const isProcessing = processingRegistrationKey === item.entity.entityKey;

    return (
      <article className="municipality-registration-card" key={item.entity.entityKey}>
        <div className="municipality-registration-card__top">
          <span
            className={
              item.isCancelled
                ? "status-pill status-pill--rejected"
                : "status-pill status-pill--approved"
            }
          >
            {item.isCancelled ? "Baja" : "Activa"}
          </span>

          <span>{formatDate(item.payload.registeredAt ?? item.entity.createdAt)}</span>
        </div>

        <h3>{item.payload.businessName ?? "Emprendimiento"}</h3>

        <p>
          {item.payload.entrepreneurName ?? "-"} -{" "}
          {item.payload.entrepreneurDocument ?? "-"}
        </p>

        <div className="municipality-fair-card__meta">
          <div>
            <span>Feria</span>
            <strong>{item.payload.fairName ?? selectedFairPayload?.name ?? "Feria"}</strong>
          </div>
          <div>
            <span>Rubro</span>
            <strong>{item.payload.fairCategory ?? selectedFairPayload?.category ?? "-"}</strong>
          </div>
          <div>
            <span>Telefono</span>
            <strong>{item.payload.phone ?? "-"}</strong>
          </div>
          <div>
            <span>Estado</span>
            <strong>{item.isCancelled ? "Baja municipal" : "Activa"}</strong>
          </div>
        </div>

        <p className="registration-description">
          {item.payload.description ?? "Sin descripcion"}
        </p>

        <div className="registration-images">
          {item.payload.standPhotoUrl && (
            <a
              href={`http://localhost:4100${item.payload.standPhotoUrl}`}
              target="_blank"
              rel="noreferrer"
            >
              Ver foto del stand
            </a>
          )}

          {(item.payload.articlePhotoUrls ?? []).map((url, index) => (
            <a
              href={`http://localhost:4100${url}`}
              target="_blank"
              rel="noreferrer"
              key={url}
            >
              Ver articulo {index + 1}
            </a>
          ))}
        </div>

        <p className="entity-key">{item.entity.entityKey}</p>

        {item.isCancelled ? (
          <div className="decision-summary">
            <span>Baja guardada en Arkiv</span>
            <strong>{formatDate(cancellationPayload?.cancelledAt)}</strong>
            <p>{cancellationPayload?.notes ?? "-"}</p>
          </div>
        ) : (
          <div className="decision-box">
            <label>
              Motivo de baja
              <textarea
                value={notesByRegistrationKey[item.entity.entityKey] ?? ""}
                onChange={(event) =>
                  setNotesByRegistrationKey((current) => ({
                    ...current,
                    [item.entity.entityKey]: event.target.value,
                  }))
                }
                placeholder="Ejemplo: no cumple requisitos / baja solicitada / cupo reasignado"
              />
            </label>

            <div className="actions">
              <button
                type="button"
                className="danger-button"
                disabled={isProcessing}
                onClick={() => cancelRegistration(item)}
              >
                {isProcessing ? "Procesando..." : "Dar de baja inscripcion"}
              </button>
            </div>
          </div>
        )}
      </article>
    );
  }

  return (
    <SafeTabs
      title="Baja de inscripciones por feria"
      subtitle="Selecciona una feria aprobada, revisa inscripciones activas y libera cupos con baja municipal."
      tabs={[
        {
          id: "feria",
          label: "Feria",
          badge: approvedFairs.length,
          content: (
            <section className="grid-layout">
              <div className="panel span-2-panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Municipalidad</p>
                    <h2>Seleccionar feria aprobada</h2>
                  </div>
                  <span className="status-pill">
                    {approvedFairs.length} ferias aprobadas
                  </span>
                </div>

                {errorMessage && <div className="error-banner">{errorMessage}</div>}

                {renderFairSelector()}
              </div>
            </section>
          ),
        },
        {
          id: "activas",
          label: "Activas",
          badge: activeRegistrations.length,
          content: (
            <section className="grid-layout">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Feria seleccionada</p>
                    <h2>Inscripciones activas</h2>
                  </div>
                  <span className="status-pill">{activeRegistrations.length} activas</span>
                </div>

                {!selectedFair ? (
                  <p className="empty-state">Selecciona una feria aprobada.</p>
                ) : activeRegistrations.length === 0 ? (
                  <p className="empty-state">
                    No hay inscripciones activas para esta feria.
                  </p>
                ) : (
                  <div className="municipality-registration-list">
                    {activeRegistrations.map(renderRegistrationCard)}
                  </div>
                )}
              </div>
            </section>
          ),
        },
        {
          id: "bajas",
          label: "Bajas",
          badge: cancelledRegistrations.length,
          content: (
            <section className="grid-layout">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Auditoria municipal</p>
                    <h2>Bajas de la feria seleccionada</h2>
                  </div>
                  <span className="status-pill">
                    {cancelledRegistrations.length} bajas
                  </span>
                </div>

                {!selectedFair ? (
                  <p className="empty-state">Selecciona una feria aprobada.</p>
                ) : cancelledRegistrations.length === 0 ? (
                  <p className="empty-state">
                    Todavia no hay bajas registradas para esta feria.
                  </p>
                ) : (
                  <div className="municipality-registration-list">
                    {cancelledRegistrations.map(renderRegistrationCard)}
                  </div>
                )}
              </div>
            </section>
          ),
        },
      ]}
    />
  );
}