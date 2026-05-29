import type { LocalArkivEntity } from "../types/feria";
import { CertificatesExplorerPanel } from "./CertificatesExplorerPanel";
import { SafeTabs } from "./SafeTabs";

type DashboardMode = "entrepreneur" | "fair_organizer" | "municipality";

type JwtPayload = {
  sub?: string;
  username?: string;
  role?: string;
  document?: string;
  fullName?: string;
};

type FairPayload = {
  name?: string;
  address?: string;
  city?: string;
  category?: string;
  availableSlots?: number;
  status?: string;
  createdByName?: string;
  createdByDocument?: string;
  createdAt?: number;
};

type DecisionPayload = {
  fairKey?: string;
  fairName?: string;
  decision?: string;
  notes?: string;
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

function decodeJwtPayload(token: string | null): JwtPayload {
  if (!token) return {};

  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(normalized)
        .split("")
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join("")
    );

    return JSON.parse(json) as JwtPayload;
  } catch {
    return {};
  }
}

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

function shortKey(value: string): string {
  if (!value) return "-";
  if (value.length <= 22) return value;
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function getLatestDecisionByFairKey(entities: LocalArkivEntity<unknown>[]) {
  const decisions = entities
    .filter((entity) => getEntityType(entity) === "fair_event_decision")
    .map((entity) => {
      const payload = getPayload<DecisionPayload>(entity);

      return {
        entity,
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

function getCancellationSet(entities: LocalArkivEntity<unknown>[]) {
  const set = new Set<string>();

  for (const entity of entities) {
    if (getEntityType(entity) !== "fair_registration_cancellation") continue;

    const payload = getPayload<CancellationPayload>(entity);
    const registrationKey = String(payload.registrationKey ?? "");

    if (registrationKey) {
      set.add(registrationKey);
    }
  }

  return set;
}

function getApprovedFairs(entities: LocalArkivEntity<unknown>[]) {
  const latestDecisionByFairKey = getLatestDecisionByFairKey(entities);

  return entities.filter((entity) => {
    if (getEntityType(entity) !== "fair_event") return false;

    const latestDecision = latestDecisionByFairKey.get(entity.entityKey);
    return latestDecision?.decision === "approved";
  });
}

function renderMiniEntity(
  entity: LocalArkivEntity<unknown>,
  title: string,
  subtitle: string
) {
  return (
    <article className="profile-mini-card" key={entity.entityKey}>
      <div>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <small>{shortKey(entity.entityKey)}</small>
    </article>
  );
}

export function ProfileScopedDashboard({
  token,
  entities,
  mode,
}: {
  token: string | null;
  entities: LocalArkivEntity<unknown>[];
  mode: DashboardMode;
}) {
  const user = decodeJwtPayload(token);
  const userDocument = String(user.document ?? user.sub ?? "");

  const fairEvents = entities.filter((entity) => getEntityType(entity) === "fair_event");
  const decisions = entities.filter((entity) => getEntityType(entity) === "fair_event_decision");
  const registrations = entities.filter((entity) => getEntityType(entity) === "fair_registration");
  const cancellations = entities.filter(
    (entity) => getEntityType(entity) === "fair_registration_cancellation"
  );
  const certificates = entities.filter((entity) => getEntityType(entity) === "fair_certificate");

  const cancellationSet = getCancellationSet(entities);
  const approvedFairs = getApprovedFairs(entities);
  const latestDecisionByFairKey = getLatestDecisionByFairKey(entities);

  const myEntrepreneurRegistrations = registrations.filter((entity) => {
    const payload = getPayload<RegistrationPayload>(entity);
    return String(payload.entrepreneurDocument ?? "") === userDocument;
  });

  const myOrganizerFairs = fairEvents.filter((entity) => {
    const payload = getPayload<FairPayload>(entity);
    return String(payload.createdByDocument ?? "") === userDocument;
  });

  const myOrganizerFairKeys = new Set(myOrganizerFairs.map((fair) => fair.entityKey));

  const myOrganizerRegistrations = registrations.filter((entity) => {
    const payload = getPayload<RegistrationPayload>(entity);
    return myOrganizerFairKeys.has(String(payload.fairKey ?? ""));
  });

  const myOrganizerDecisions = decisions.filter((entity) => {
    const payload = getPayload<DecisionPayload>(entity);
    return myOrganizerFairKeys.has(String(payload.fairKey ?? ""));
  });

  const activeRegistrations = registrations.filter(
    (entity) => !cancellationSet.has(entity.entityKey)
  );

  const cancelledRegistrations = registrations.filter((entity) =>
    cancellationSet.has(entity.entityKey)
  );

  if (mode === "entrepreneur") {
    return (
      <SafeTabs
        title="Panel del emprendedor"
        subtitle="Consulta tus inscripciones, certificados y ferias aprobadas disponibles."
        tabs={[
          {
            id: "inscripciones",
            label: "Mis inscripciones",
            badge: myEntrepreneurRegistrations.length,
            content: (
              <section className="grid-layout bottom-grid entrepreneur-tab-grid">
                <div className="panel span-2-panel">
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow">Mi perfil</p>
                      <h2>Mis inscripciones</h2>
                    </div>
                    <span className="status-pill">
                      {myEntrepreneurRegistrations.length} registros
                    </span>
                  </div>

                  {myEntrepreneurRegistrations.length === 0 ? (
                    <p className="empty-state">
                      Todavia no tenes inscripciones registradas.
                    </p>
                  ) : (
                    <div className="profile-mini-list profile-mini-list--grid">
                      {myEntrepreneurRegistrations.map((entity) => {
                        const payload = getPayload<RegistrationPayload>(entity);
                        const isCancelled = cancellationSet.has(entity.entityKey);

                        return renderMiniEntity(
                          entity,
                          String(payload.businessName ?? "Emprendimiento"),
                          `${payload.fairName ?? "Feria"} - ${isCancelled ? "baja" : "activa"}`
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            ),
          },
          {
            id: "certificados",
            label: "Mis certificados",
            badge: certificates.filter((entity) => {
              const payload = getPayload<{ entrepreneurDocument?: string }>(entity);
              return String(payload.entrepreneurDocument ?? "") === userDocument;
            }).length,
            content: (
              <section className="grid-layout bottom-grid entrepreneur-tab-grid">
                <div className="span-2-panel">
                  <CertificatesExplorerPanel
                    entities={entities}
                    entrepreneurDocument={userDocument}
                    title="Mis certificados"
                    subtitle="Selecciona un certificado para ver el detalle completo y el QR verificable."
                  />
                </div>
              </section>
            ),
          },
          {
            id: "ferias",
            label: "Ferias disponibles",
            badge: approvedFairs.length,
            content: (
              <section className="grid-layout bottom-grid entrepreneur-tab-grid">
                <div className="panel span-2-panel">
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow">Ferias disponibles</p>
                      <h2>Ferias aprobadas visibles para emprendedor</h2>
                    </div>
                    <span className="status-pill">{approvedFairs.length} ferias</span>
                  </div>

                  {approvedFairs.length === 0 ? (
                    <p className="empty-state">No hay ferias aprobadas disponibles.</p>
                  ) : (
                    <div className="profile-mini-list profile-mini-list--grid">
                      {approvedFairs.map((entity) => {
                        const payload = getPayload<FairPayload>(entity);

                        return renderMiniEntity(
                          entity,
                          String(payload.name ?? "Feria"),
                          `${payload.address ?? "Sin direccion"} - ${payload.category ?? "-"}`
                        );
                      })}
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

  if (mode === "fair_organizer") {
    return (
      <section className="grid-layout bottom-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Mi perfil feriante</p>
              <h2>Ferias creadas por mi</h2>
            </div>
            <span className="status-pill">{myOrganizerFairs.length} ferias</span>
          </div>

          {myOrganizerFairs.length === 0 ? (
            <p className="empty-state">Todavia no creaste ferias.</p>
          ) : (
            <div className="profile-mini-list">
              {myOrganizerFairs.map((entity) => {
                const payload = getPayload<FairPayload>(entity);
                const decision = latestDecisionByFairKey.get(entity.entityKey);

                return renderMiniEntity(
                  entity,
                  String(payload.name ?? "Feria"),
                  `${payload.address ?? "Sin direccion"} - ${decision?.decision ?? "pending"}`
                );
              })}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Inscripciones recibidas</p>
              <h2>Emprendedores en mis ferias</h2>
            </div>
            <span className="status-pill">{myOrganizerRegistrations.length} registros</span>
          </div>

          {myOrganizerRegistrations.length === 0 ? (
            <p className="empty-state">Todavia no hay inscripciones en tus ferias.</p>
          ) : (
            <div className="profile-mini-list">
              {myOrganizerRegistrations.map((entity) => {
                const payload = getPayload<RegistrationPayload>(entity);
                const isCancelled = cancellationSet.has(entity.entityKey);

                return renderMiniEntity(
                  entity,
                  String(payload.businessName ?? "Emprendimiento"),
                  `${payload.fairName ?? "Feria"} - ${isCancelled ? "baja" : "activa"}`
                );
              })}
            </div>
          )}
        </div>

        <div className="panel span-2-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Municipalidad</p>
              <h2>Decisiones sobre mis ferias</h2>
            </div>
            <span className="status-pill">{myOrganizerDecisions.length} decisiones</span>
          </div>

          {myOrganizerDecisions.length === 0 ? (
            <p className="empty-state">Todavia no hay decisiones municipales sobre tus ferias.</p>
          ) : (
            <div className="profile-mini-list profile-mini-list--grid">
              {myOrganizerDecisions.map((entity) => {
                const payload = getPayload<DecisionPayload>(entity);

                return renderMiniEntity(
                  entity,
                  String(payload.fairName ?? "Feria"),
                  `${payload.decision ?? "-"} - ${payload.notes ?? ""}`
                );
              })}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="grid-layout bottom-grid">
      <div className="panel span-2-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Municipalidad</p>
            <h2>Vista total del sistema</h2>
          </div>
          <span className="status-pill">vista completa</span>
        </div>

        <div className="profile-total-grid">
          <div>
            <span>Ferias</span>
            <strong>{fairEvents.length}</strong>
          </div>
          <div>
            <span>Ferias aprobadas</span>
            <strong>{approvedFairs.length}</strong>
          </div>
          <div>
            <span>Inscripciones activas</span>
            <strong>{activeRegistrations.length}</strong>
          </div>
          <div>
            <span>Inscripciones dadas de baja</span>
            <strong>{cancelledRegistrations.length}</strong>
          </div>
          <div>
            <span>Certificados</span>
            <strong>{certificates.length}</strong>
          </div>
          <div>
            <span>Decisiones</span>
            <strong>{decisions.length}</strong>
          </div>
          <div>
            <span>Bajas</span>
            <strong>{cancellations.length}</strong>
          </div>
          <div>
            <span>Total entidades</span>
            <strong>{entities.length}</strong>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Auditoria</p>
            <h2>Ultimas ferias</h2>
          </div>
          <span className="status-pill">{fairEvents.length} ferias</span>
        </div>

        <div className="profile-mini-list">
          {fairEvents.slice(0, 8).map((entity) => {
            const payload = getPayload<FairPayload>(entity);

            return renderMiniEntity(
              entity,
              String(payload.name ?? "Feria"),
              `${payload.createdByName ?? "-"} - ${payload.address ?? "-"}`
            );
          })}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Auditoria</p>
            <h2>Ultimas inscripciones</h2>
          </div>
          <span className="status-pill">{registrations.length} registros</span>
        </div>

        <div className="profile-mini-list">
          {registrations.slice(0, 8).map((entity) => {
            const payload = getPayload<RegistrationPayload>(entity);
            const isCancelled = cancellationSet.has(entity.entityKey);

            return renderMiniEntity(
              entity,
              String(payload.businessName ?? "Emprendimiento"),
              `${payload.fairName ?? "Feria"} - ${isCancelled ? "baja" : "activa"}`
            );
          })}
        </div>
      </div>

      <div className="span-2-panel">
        <CertificatesExplorerPanel
          entities={entities}
          showAll
          title="Certificados emitidos"
          subtitle="Vista municipal completa de certificados emitidos."
        />
      </div>
    </section>
  );
}