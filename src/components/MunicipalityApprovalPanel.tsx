import { useMemo, useState } from "react";
import { SafeTabs } from "./SafeTabs";
import { backendCreateFairDecision } from "../services/backendApi";
import type { LocalArkivEntity } from "../types/feria";

type DecisionValue = "approved" | "rejected";

type FairEventPayload = {
  name?: string;
  address?: string;
  city?: string;
  category?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  availableSlots?: number;
  latitude?: number;
  longitude?: number;
  status?: string;
  createdByName?: string;
};

type DecisionPayload = {
  fairKey?: string;
  decision?: DecisionValue;
  notes?: string;
  decidedAt?: number;
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

function buildLatestDecisionMap(entities: LocalArkivEntity<unknown>[]) {
  const decisions = entities
    .filter((entity) => getEntityType(entity) === "fair_event_decision")
    .map((entity) => {
      const payload = getPayload<DecisionPayload>(entity);

      return {
        entity,
        fairKey: String(payload.fairKey ?? ""),
        decision: payload.decision,
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

function isPendingStatus(status: unknown): boolean {
  const normalized = String(status ?? "pending").toLowerCase().trim();

  return normalized === "pending" || normalized === "pendiente" || normalized === "pendientes";
}

export function MunicipalityApprovalPanel({
  token,
  entities,
  onDecisionCreated,
}: {
  token: string | null;
  entities: LocalArkivEntity<unknown>[];
  onDecisionCreated: () => Promise<void> | void;
}) {
  const [notesByFairKey, setNotesByFairKey] = useState<Record<string, string>>({});
  const [processingFairKey, setProcessingFairKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const latestDecisionByFairKey = useMemo(
    () => buildLatestDecisionMap(entities),
    [entities]
  );

  const fairEvents = useMemo(() => {
    return entities
      .filter((entity) => getEntityType(entity) === "fair_event")
      .map((entity) => ({
        entity,
        payload: getPayload<FairEventPayload>(entity),
      }))
      .sort((a, b) => b.entity.createdAt - a.entity.createdAt);
  }, [entities]);

  const pendingFairs = fairEvents.filter((item) => {
    const hasDecision = latestDecisionByFairKey.has(item.entity.entityKey);
    return isPendingStatus(item.payload.status) && !hasDecision;
  });

  const approvedFairs = fairEvents.filter((item) => {
    const decision = latestDecisionByFairKey.get(item.entity.entityKey);
    return decision?.decision === "approved";
  });

  const rejectedFairs = fairEvents.filter((item) => {
    const decision = latestDecisionByFairKey.get(item.entity.entityKey);
    return decision?.decision === "rejected";
  });

  async function decideFair(
    entity: LocalArkivEntity<unknown>,
    payload: FairEventPayload,
    decision: DecisionValue
  ) {
    if (!token) {
      alert("No hay token de sesion. Inicia sesion de nuevo.");
      return;
    }

    const fairKey = entity.entityKey;
    const notes =
      notesByFairKey[fairKey]?.trim() ||
      (decision === "approved"
        ? "Aprobado por la municipalidad."
        : "Rechazado por la municipalidad.");

    setProcessingFairKey(fairKey);
    setErrorMessage("");

    try {
      await backendCreateFairDecision({
        token,
        fairKey,
        fairName: String(payload.name ?? "Feria sin nombre"),
        fairAddress: String(payload.address ?? "Sin direccion"),
        fairCategory: String(payload.category ?? "sin_rubro"),
        fairCity: String(payload.city ?? "Salta"),
        decision,
        notes,
      });

      await onDecisionCreated();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo registrar la decision municipal.";

      setErrorMessage(message);
    } finally {
      setProcessingFairKey(null);
    }
  }

  function renderFairCard(
    item: {
      entity: LocalArkivEntity<unknown>;
      payload: FairEventPayload;
    },
    mode: "pending" | "approved" | "rejected"
  ) {
    const decision = latestDecisionByFairKey.get(item.entity.entityKey);
    const isProcessing = processingFairKey === item.entity.entityKey;
    const decisionPayload = decision
      ? getPayload<DecisionPayload>(decision.entity)
      : null;

    return (
      <article className="municipality-fair-card" key={item.entity.entityKey}>
        <div className="municipality-fair-card__top">
          <span
            className={
              mode === "approved"
                ? "status-pill status-pill--approved"
                : mode === "rejected"
                  ? "status-pill status-pill--rejected"
                  : "status-pill"
            }
          >
            {mode === "approved"
              ? "Aprobada"
              : mode === "rejected"
                ? "Rechazada"
                : "Pendiente"}
          </span>

          <span>{formatDate(item.entity.createdAt)}</span>
        </div>

        <h3>{item.payload.name ?? "Feria sin nombre"}</h3>

        <p>{item.payload.description ?? "Sin descripcion"}</p>

        <div className="municipality-fair-card__meta">
          <div>
            <span>Direccion</span>
            <strong>{item.payload.address ?? "-"}</strong>
          </div>
          <div>
            <span>Rubro</span>
            <strong>{item.payload.category ?? "-"}</strong>
          </div>
          <div>
            <span>Cupos</span>
            <strong>{item.payload.availableSlots ?? "-"}</strong>
          </div>
          <div>
            <span>Feriante</span>
            <strong>{item.payload.createdByName ?? "-"}</strong>
          </div>
        </div>

        <p className="entity-key">{item.entity.entityKey}</p>

        {mode === "pending" ? (
          <div className="decision-box">
            <label>
              Observacion municipal
              <textarea
                value={notesByFairKey[item.entity.entityKey] ?? ""}
                onChange={(event) =>
                  setNotesByFairKey((current) => ({
                    ...current,
                    [item.entity.entityKey]: event.target.value,
                  }))
                }
                placeholder="Ejemplo: aprobado para participar / falta documentacion"
              />
            </label>

            <div className="actions">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => decideFair(item.entity, item.payload, "approved")}
              >
                {isProcessing ? "Procesando..." : "Aprobar"}
              </button>

              <button
                type="button"
                className="danger-button"
                disabled={isProcessing}
                onClick={() => decideFair(item.entity, item.payload, "rejected")}
              >
                Rechazar
              </button>
            </div>
          </div>
        ) : (
          <div className="decision-summary">
            <span>Decision guardada en Arkiv</span>
            <strong>
              {decisionPayload?.decision === "approved" ? "Aprobada" : "Rechazada"}
            </strong>
            <p>{decisionPayload?.notes ?? "-"}</p>
          </div>
        )}
      </article>
    );
  }

  return (
    <SafeTabs
      title="Gestion de ferias municipales"
      subtitle="Aproba, rechaza y revisa el historial municipal sin perder contexto."
      tabs={[
        {
          id: "pendientes",
          label: "Pendientes",
          badge: pendingFairs.length,
          content: (
            <section className="grid-layout">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Municipalidad</p>
                    <h2>Ferias pendientes</h2>
                  </div>
                  <span className="status-pill">{pendingFairs.length} pendientes</span>
                </div>

                {errorMessage && <div className="error-banner">{errorMessage}</div>}

                {pendingFairs.length === 0 ? (
                  <p className="empty-state">
                    No hay ferias pendientes. Sincroniza desde backend o crea una feria como feriante.
                  </p>
                ) : (
                  <div className="municipality-fair-list">
                    {pendingFairs.map((item) => renderFairCard(item, "pending"))}
                  </div>
                )}
              </div>
            </section>
          ),
        },
        {
          id: "aprobadas",
          label: "Aprobadas",
          badge: approvedFairs.length,
          content: (
            <section className="grid-layout">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Historial municipal</p>
                    <h2>Ferias aprobadas</h2>
                  </div>
                  <span className="status-pill">{approvedFairs.length} aprobadas</span>
                </div>

                {approvedFairs.length === 0 ? (
                  <p className="empty-state">Todavia no hay ferias aprobadas.</p>
                ) : (
                  <div className="municipality-fair-list">
                    {approvedFairs.map((item) => renderFairCard(item, "approved"))}
                  </div>
                )}
              </div>
            </section>
          ),
        },
        {
          id: "rechazadas",
          label: "Rechazadas",
          badge: rejectedFairs.length,
          content: (
            <section className="grid-layout">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Historial municipal</p>
                    <h2>Ferias rechazadas</h2>
                  </div>
                  <span className="status-pill">{rejectedFairs.length} rechazadas</span>
                </div>

                {rejectedFairs.length === 0 ? (
                  <p className="empty-state">Todavia no hay ferias rechazadas.</p>
                ) : (
                  <div className="municipality-fair-list">
                    {rejectedFairs.map((item) => renderFairCard(item, "rejected"))}
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