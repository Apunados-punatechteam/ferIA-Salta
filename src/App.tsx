import { type FormEvent, useEffect, useMemo, useState } from "react";
import { RegisterAccountPanel } from "./components/RegisterAccountPanel";
import "./index.css";

import { FairOrganizerPanel } from "./components/FairOrganizerPanel";
import { MunicipalityApprovalPanel } from "./components/MunicipalityApprovalPanel";
import { MunicipalityRegistrationsPanel } from "./components/MunicipalityRegistrationsPanel";
import { ProfileScopedDashboard } from "./components/ProfileScopedDashboard";
import { EntrepreneurRegistrationPanel } from "./components/EntrepreneurRegistrationPanel";
import { StellarPaymentsPanel } from "./components/StellarPaymentsPanel";
import {
  backendListArkivEntities,
  backendLogin,
  clearAuthToken,
  getAuthToken,
  storeAuthToken,
} from "./services/backendApi";
import type { AuthUser, LocalArkivEntity, UserRole } from "./types/feria";
const defaultUiOptionsForLegacyPatch = { silent: false };
const options = defaultUiOptionsForLegacyPatch;

const AUTH_STORAGE_KEY = "feria_auth_user_prod";

type AppSection = "entrepreneur" | "fair_organizer" | "municipality" | "all";


function getCurrentUserFromToken(token: string | null): {
  sub?: string;
  username?: string;
  role?: string;
  document?: string;
  fullName?: string;
} {
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

    return JSON.parse(json) as {
      sub?: string;
      username?: string;
      role?: string;
      document?: string;
      fullName?: string;
    };
  } catch {
    return {};
  }
}

function getEntityAttributeValue(entity: LocalArkivEntity<unknown>, key: string): string {
  const attr = entity.attributes.find((item) => item.key === key);
  return String(attr?.value ?? "");
}

function getEntityPayloadObject(entity: LocalArkivEntity<unknown>): Record<string, unknown> {
  if (entity.payload && typeof entity.payload === "object") {
    return entity.payload as Record<string, unknown>;
  }

  return {};
}

function getScopedMetricEntities(
  entities: LocalArkivEntity<unknown>[],
  token: string | null,
  activeSection: AppSection
): LocalArkivEntity<unknown>[] {
  const user = getCurrentUserFromToken(token);
  const role = String(user.role ?? "").toUpperCase();
  const document = String(user.document ?? "");
  const userId = String(user.sub ?? "");

  if (role === "MUNICIPALITY" || activeSection === "all") {
    return entities;
  }

  const fairEvents = entities.filter(
    (entity) => getEntityAttributeValue(entity, "entityType") === "fair_event"
  );

  const myFairKeys = new Set<string>();

  for (const fair of fairEvents) {
    const payload = getEntityPayloadObject(fair);
    const createdByDocument = String(payload.createdByDocument ?? "");
    const createdByUserId = String(payload.createdByUserId ?? "");
    const organizerDocument = String(payload.organizerDocument ?? "");

    if (
      createdByDocument === document ||
      createdByUserId === userId ||
      organizerDocument === document
    ) {
      myFairKeys.add(fair.entityKey);
    }
  }

  if (role === "FAIR_ORGANIZER") {
    return entities.filter((entity) => {
      const entityType = getEntityAttributeValue(entity, "entityType");
      const payload = getEntityPayloadObject(entity);

      if (entityType === "fair_event") {
        return myFairKeys.has(entity.entityKey);
      }

      const fairKey = String(payload.fairKey ?? "");
      return fairKey && myFairKeys.has(fairKey);
    });
  }

  if (role === "ENTREPRENEUR") {
    return entities.filter((entity) => {
      const entityType = getEntityAttributeValue(entity, "entityType");
      const payload = getEntityPayloadObject(entity);

      if (entityType === "fair_event") {
        return false;
      }

      const entrepreneurDocument = String(payload.entrepreneurDocument ?? "");
      const applicantDocument = String(payload.applicantDocument ?? "");
      const userDocument = String(payload.document ?? "");

      return (
        entrepreneurDocument === document ||
        applicantDocument === document ||
        userDocument === document
      );
    });
  }

  return entities;
}
function readAuthUser(): AuthUser | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

function saveAuthUser(user: AuthUser): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

function clearAuthUser(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function roleLabel(role: UserRole): string {
  if (role === "municipality") return "Municipalidad";
  if (role === "fair_organizer") return "Feriante";
  return "Emprendedor";
}

function getDefaultSectionForRol(role?: UserRole): AppSection {
  if (role === "municipality") return "municipality";
  if (role === "fair_organizer") return "fair_organizer";
  return "entrepreneur";
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function getEntityType(entity: LocalArkivEntity<unknown>): string {
  const attr = entity.attributes.find((item) => item.key === "entityType");
  return String(attr?.value ?? "unknown");
}

function getPayloadObject(entity: LocalArkivEntity<unknown>): Record<string, unknown> {
  if (entity.payload && typeof entity.payload === "object") {
    return entity.payload as Record<string, unknown>;
  }

  return {};
}

function entityLabel(entityType: string): string {
  const labels: Record<string, string> = {
    entrepreneur_profile: "Perfil",
    fair_application: "Inscripcion",
    fair_certificate: "Certificado",
    fair_event: "Feria",
    fair_event_decision: "Feria decision",
    fair_registration: "Feria registration",
    municipality_decision: "Decision municipal",
    assistant_message: "Mensaje IA",
    payment_record: "Pago",
    user_profile: "Usuario",
  };

  return labels[entityType] ?? entityType;
}

function getLatestFairDecisionByFairKey(entities: LocalArkivEntity<unknown>[]) {
  const latestDecisionByFeriaKey = new Map<
    string,
    { decision: string; decidedAt: number }
  >();

  for (const entity of entities) {
    if (getEntityType(entity) !== "fair_event_decision") continue;

    const payload = getPayloadObject(entity);
    const fairKey = String(payload.fairKey ?? "");
    const decision = String(payload.decision ?? "");
    const decidedAt = Number(payload.decidedAt ?? entity.createdAt);

    if (!fairKey || !decision) continue;

    const current = latestDecisionByFeriaKey.get(fairKey);

    if (!current || decidedAt > current.decidedAt) {
      latestDecisionByFeriaKey.set(fairKey, { decision, decidedAt });
    }
  }

  return latestDecisionByFeriaKey;
}

function LoginScreen({
  onLogin,
}: {
  onLogin: (user: AuthUser) => void;
}) {
  const [username, setUsuarioname] = useState("municipalidad");
  const [password, setContrasena] = useState("muni123");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!username.trim()) {
      alert("Ingresa el usuario.");
      return;
    }

    if (!password.trim()) {
      alert("Ingresa la contrasena.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const login = await backendLogin({
        username: username.trim(),
        password: password.trim(),
      });

      saveAuthUser(login.user);
      storeAuthToken(login.token);
      onLogin(login.user);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo iniciar sesion.";
      if (!options.silent) {
        setErrorMessage(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function fillDemoUsuario(nextUsuarioname: string, nextContrasena: string) {
    setUsuarioname(nextUsuarioname);
    setContrasena(nextContrasena);
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div>
          <p className="eyebrow">PunaTech Hackathon - Arkiv Track</p>
          <h1>FerIA</h1>
          <p className="hero-subtitle">
            Flujo productivo para feriantes, emprendedores y municipalidad.
            El login usa backend, PostgreSQL, bcrypt y JWT.
          </p>
        </div>
{errorMessage && <div className="error-banner">{errorMessage}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Usuario
            <input
              value={username}
              onChange={(event) => setUsuarioname(event.target.value)}
              placeholder="municipalidad"
            />
          </label>

          <label>
            Contrasena
            <input
              type="password"
              value={password}
              onChange={(event) => setContrasena(event.target.value)}
              placeholder="password"
            />
          </label>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Ingresando..." : "Ingresar a FerIA"}
          </button>
        </form>

        <div className="login-hint">
          <RegisterAccountPanel />
<strong>Usuarios demo:</strong>

          <div className="demo-users-grid">
            <button
              type="button"
              className="demo-user-button"
              onClick={() => fillDemoUsuario("emprendedor", "emprendedor123")}
            >
              <span>Emprendedor</span>
              <code>emprendedor / emprendedor123</code>
            </button>

            <button
              type="button"
              className="demo-user-button"
              onClick={() => fillDemoUsuario("feriante", "feriante123")}
            >
              <span>Feriante</span>
              <code>feriante / feriante123</code>
            </button>

            <button
              type="button"
              className="demo-user-button"
              onClick={() => fillDemoUsuario("municipalidad", "muni123")}
            >
              <span>Municipalidad</span>
              <code>municipalidad / muni123</code>
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function EntityCard({ entity }: { entity: LocalArkivEntity<unknown> }) {
  const entityType = getEntityType(entity);
  const payload = getPayloadObject(entity);

  const title =
    String(
      payload.name ??
        payload.businessName ??
        payload.certificateNumber ??
        payload.fairName ??
        entityLabel(entityType)
    ) || entityLabel(entityType);

  const subtitle =
    String(
      payload.address ??
        payload.status ??
        payload.decision ??
        payload.category ??
        payload.documentNumber ??
        ""
    ) || "Entidad Arkiv";

  return (
    <article className="entity-card">
      <div className="entity-card__top">
        <span className="entity-badge">{entityType}</span>
        <span className="entity-date">{formatDate(entity.createdAt)}</span>
      </div>

      <h3>{title}</h3>
      <p>{subtitle}</p>

      {entity.txHash && <p className="tx-line">tx: {entity.txHash}</p>}

      <p className="entity-key">{entity.entityKey}</p>
    </article>
  );
}

function decodeTokenRole(token: string | null): string {
  if (!token) return "";

  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(normalized)
        .split("")
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join("")
    );

    const parsed = JSON.parse(json) as { role?: string };
    return String(parsed.role ?? "").toLowerCase();
  } catch {
    return "";
  }
}

function canAccessSectionByRole(token: string | null, section: AppSection): boolean {
  const role = decodeTokenRole(token);

  if (role === "municipality") return true;
  if (role === "fair_organizer") return section === "fair_organizer";
  return section === "entrepreneur";
}
function App() {
  const initialAuthUser = readAuthUser();

  const [authUsuario, setAuthUser] = useState<AuthUser | null>(initialAuthUser);
  const [activeSection, setActiveSection] = useState<AppSection>(
    getDefaultSectionForRol(initialAuthUser?.role)
  );
  const [entities, setEntities] = useState<LocalArkivEntity<unknown>[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasInitialSyncRun, setHasInitialSyncRun] = useState(false);
const [errorMessage, setErrorMessage] = useState("");
  const [lastSyncFuente, setLastSyncFuente] = useState("Sin sincronizar");

  const latestFairDecisionByFairKey = useMemo(
    () => getLatestFairDecisionByFairKey(entities),
    [entities]
  );

  const approvedFairEntities = useMemo(() => {
    return entities.filter((entity) => {
      if (getEntityType(entity) !== "fair_event") return false;

      const latestDecision = latestFairDecisionByFairKey.get(entity.entityKey);
      return latestDecision?.decision === "approved";
    });
  }, [entities, latestFairDecisionByFairKey]);

  const scopedMetricEntities = useMemo(() => {
    return getScopedMetricEntities(entities, getAuthToken(), activeSection);
  }, [entities, activeSection]);

  const entityStats = useMemo(() => {
    return scopedMetricEntities.reduce(
      (acc, entity) => {
        const type = getEntityType(entity);

        if (type === "entrepreneur_profile") acc.profiles += 1;
        if (type === "fair_application") acc.applications += 1;
        if (type === "fair_certificate") acc.certificates += 1;
        if (type === "fair_event") acc.fairs += 1;
        if (type === "fair_registration") acc.registrations += 1;
        if (type === "municipality_decision") acc.decisions += 1;
        if (type === "fair_event_decision") acc.fairDecisions += 1;

        return acc;
      },
      {
        profiles: 0,
        applications: 0,
        certificates: 0,
        fairs: 0,
        registrations: 0,
        decisions: 0,
        fairDecisions: 0,
      }
    );
  }, [scopedMetricEntities]);

  const fairEntities = useMemo(() => {
    return scopedMetricEntities.filter((entity) => getEntityType(entity) === "fair_event");
  }, [scopedMetricEntities]);

  const registrationEntities = useMemo(() => {
    return entities.filter(
      (entity) => getEntityType(entity) === "fair_registration"
    );
  }, [scopedMetricEntities]);

  const decisionEntities = useMemo(() => {
    return entities.filter((entity) =>
      ["municipality_decision", "fair_event_decision"].includes(
        getEntityType(entity)
      )
    );
  }, [scopedMetricEntities]);

  async function handleSyncFromBackend(options: { silent?: boolean } = {}) {
    setIsSyncing(true);
    setErrorMessage("");

    try {
      const token = getAuthToken();

      if (!token) {
        throw new Error("No hay token de sesion. Inicia sesion de nuevo.");
      }

      const syncedEntities = await backendListArkivEntities(token);
      setEntities(syncedEntities);
      setLastSyncFuente("Backend a Arkiv");
    } catch (error) {
      const message =
        error instanceof Error && error.message !== "Internal Server Error"
          ? error.message
          : "No se pudo actualizar desde Arkiv en este momento. Reintenta en unos segundos.";
      if (!options.silent) {
        setErrorMessage(message);
      }
    } finally {
      setHasInitialSyncRun(true);
      setIsSyncing(false);
    }
  }

  function handleLogout() {
    clearAuthUser();
    clearAuthToken();
    setAuthUser(null);
    setEntities([]);
    setHasInitialSyncRun(false);
    setActiveSection("entrepreneur");
  }

  function handleLogin(user: AuthUser) {
    setAuthUser(user);
    setEntities([]);
    setHasInitialSyncRun(false);
setActiveSection(getDefaultSectionForRol(user.role));
  }

  function renderHeader() {
    if (!authUsuario) return null;

    return (
      <header className="hero">
        <div>
          <p className="eyebrow">PunaTech Hackathon - Arkiv Track</p>
          <h1>FerIA</h1>
          <p className="hero-subtitle">
            Flujo productivo con login real, backend seguro y datos verificables
            en Arkiv.
          </p>

          <div className="mode-toggle">
            <button
              type="button"
              className={activeSection === "entrepreneur" ? "mode-active" : "ghost"}
              disabled={!canAccessSectionByRole(getAuthToken(), "entrepreneur" as AppSection)} onClick={() => canAccessSectionByRole(getAuthToken(), "entrepreneur" as AppSection) && setActiveSection("entrepreneur" as AppSection)}
            >
              Emprendedor
            </button>

            <button
              type="button"
              className={activeSection === "fair_organizer" ? "mode-active" : "ghost"}
              disabled={!canAccessSectionByRole(getAuthToken(), "fair_organizer" as AppSection)} onClick={() => canAccessSectionByRole(getAuthToken(), "fair_organizer" as AppSection) && setActiveSection("fair_organizer" as AppSection)}
            >
              Feriante
            </button>

            <button
              type="button"
              className={activeSection === "municipality" ? "mode-active" : "ghost"}
              disabled={!canAccessSectionByRole(getAuthToken(), "municipality" as AppSection)} onClick={() => canAccessSectionByRole(getAuthToken(), "municipality" as AppSection) && setActiveSection("municipality" as AppSection)}
            >
              Municipalidad
            </button>

            <button
              type="button"
              className={activeSection === "all" ? "mode-active" : "ghost"}
              disabled={!canAccessSectionByRole(getAuthToken(), "all" as AppSection)} onClick={() => canAccessSectionByRole(getAuthToken(), "all" as AppSection) && setActiveSection("all" as AppSection)}
            >
              Ver todo
            </button>
          </div>
        </div>

        <aside className="project-card">
          <span>Sesion</span>
          <strong>{authUsuario.fullName}</strong>

          <span>Usuario</span>
          <strong>{authUsuario.username ?? "-"}</strong>

          <span>Rol</span>
          <strong>{roleLabel(authUsuario.role)}</strong>

          <span>Fuente</span>
          <strong>{lastSyncFuente}</strong>

          <button type="button" className="ghost" onClick={handleLogout}>
            Cerrar sesion
          </button>
        </aside>
      </header>
    );
  }

    useEffect(() => {
    // Bloque 3.5N.4C-PROD - auto sync inicial estable
    const token = getAuthToken();

    if (!authUsuario || !token) {
      return;
    }

    if (hasInitialSyncRun || isSyncing) {
      return;
    }

    void handleSyncFromBackend({ silent: true });
  }, [authUsuario?.username, authUsuario?.role, hasInitialSyncRun, isSyncing]);
function renderStats() {
    // Bloque 3.5N.2 - ocultar stats para emprendedor
    const currentUserForStats = getCurrentUserFromToken(getAuthToken());
    const currentRoleForStats = String(currentUserForStats.role ?? "").toUpperCase();

    if (currentRoleForStats === "ENTREPRENEUR" || activeSection === "entrepreneur") {
      return null;
    }

    return (
      <section className="stats-grid stats-grid--six">
        <div className="stat-card">
          <span>Perfiles</span>
          <strong>{entityStats.profiles}</strong>
        </div>
        <div className="stat-card">
          <span>Inscripciones</span>
          <strong>{entityStats.applications}</strong>
        </div>
        <div className="stat-card">
          <span>Certificados</span>
          <strong>{entityStats.certificates}</strong>
        </div>
        <div className="stat-card">
          <span>Ferias</span>
          <strong>{entityStats.fairs}</strong>
        </div>
        <div className="stat-card">
          <span>Registros a feria</span>
          <strong>{entityStats.registrations}</strong>
        </div>
        <div className="stat-card">
          <span>Decisiones</span>
          <strong>{entityStats.decisions + entityStats.fairDecisions}</strong>
        </div>
      </section>
    );
  }

  function renderEntitiesPanel(title = "Entidades desde Arkiv") {
    return (
      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Modelo Arkiv</p>
            <h2>{title}</h2>
          </div>
          <span className="status-pill">{entities.length} entities</span>
        </div>

        <div className="actions">
          <button
            type="button"
            className="secondary"
            onClick={() => void handleSyncFromBackend()}
            disabled={isSyncing}
          >
            {isSyncing ? "Actualizando..." : "Actualizar datos"}
          </button>
        </div>

        {entities.length === 0 ? (
          <p className="empty-state">
            No entities loaded in this panel yet. Use Actualizar datos.
          </p>
        ) : (
          <div className="entity-list">
            {entities.map((entity) => (
              <EntityCard entity={entity} key={entity.entityKey} />
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderEntrepreneurPanel() {
    return (
      <>
        <EntrepreneurRegistrationPanel
          token={getAuthToken()}
          entities={entities}
          approvedFairEntities={approvedFairEntities}
          onRegistered={handleSyncFromBackend}
        />
        <StellarPaymentsPanel
          token={getAuthToken()}
          entities={entities}
          onPaymentConfirmed={() => handleSyncFromBackend({ silent: true })}
        />



        <ProfileScopedDashboard
          token={getAuthToken()}
          entities={entities}
          mode="entrepreneur"
        />
      </>
    );
  }
  function renderFairOrganizerPanel() {
    return (
      <>
        <FairOrganizerPanel
          token={getAuthToken()}
          onCreated={handleSyncFromBackend}
        />

        <section className="grid-layout bottom-grid">
          {renderEntitiesPanel("Feriante fairs and entities")}
          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Feriante flow</p>
                <h2>Estado productivo</h2>
              </div>
            </div>

            <div className="roadmap-list">
              <div>
                <strong>1. Login real</strong>
                <span>Validado con PostgreSQL.</span>
              </div>
              <div>
                <strong>2. Crear feria</strong>
                <span>React llama al backend.</span>
              </div>
              <div>
                <strong>3. Firma segura</strong>
                <span>Backend signs and writes en Arkiv.</span>
              </div>
              <div>
                <strong>4. Decision municipal</strong>
                <span>Municipalidad approves or rejects.</span>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  function renderMunicipalidadPanel() {
    return (
      <>
        <MunicipalityApprovalPanel
          token={getAuthToken()}
          entities={entities}
          onDecisionCreated={handleSyncFromBackend}
        />


        <MunicipalityRegistrationsPanel
          token={getAuthToken()}
          entities={entities}
          onCancelled={handleSyncFromBackend}
        />

        <ProfileScopedDashboard
          token={getAuthToken()}
          entities={entities}
          mode="municipality"
        />
        <section className="grid-layout bottom-grid">
          {renderEntitiesPanel("Auditoria completa Arkiv")}
        </section>
      </>
    );
  }

  function renderAllPanel() {
    return (
      <>
        <section className="grid-layout bottom-grid">
          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Vista general</p>
                <h2>Resumen del sistema</h2>
              </div>
              <span className="status-pill">Base productiva</span>
            </div>

            <div className="summary-grid">
              <div>
                <span>Perfiles</span>
                <strong>{entityStats.profiles}</strong>
              </div>
              <div>
                <span>Ferias</span>
                <strong>{entityStats.fairs}</strong>
              </div>
              <div>
                <span>Registros</span>
                <strong>{entityStats.registrations}</strong>
              </div>
              <div>
                <span>Decisiones</span>
                <strong>{entityStats.decisions + entityStats.fairDecisions}</strong>
              </div>
              <div>
                <span>Certificados</span>
                <strong>{entityStats.certificates}</strong>
              </div>
              <div>
                <span>Total Arkiv</span>
                <strong>{entities.length}</strong>
              </div>
            </div>

            <div className="actions">
              <button
                type="button"
                className="secondary"
                onClick={() => void handleSyncFromBackend()}
                disabled={isSyncing}
              >
                {isSyncing ? "Actualizando..." : "Actualizar datos"}
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Ferias</p>
                <h2>fair_event</h2>
              </div>
              <span className="status-pill">{fairEntities.length} fairs</span>
            </div>

            <div className="final-list">
              {fairEntities.length === 0 ? (
                <p className="empty-state">No hay ferias cargadas.</p>
              ) : (
                fairEntities.map((entity) => (
                  <EntityCard entity={entity} key={entity.entityKey} />
                ))
              )}
            </div>
          </div>
        </section>

        <section className="grid-layout bottom-grid">
          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Registros</p>
                <h2>fair_registration</h2>
              </div>
              <span className="status-pill">
                {registrationEntities.length} registrations
              </span>
            </div>

            <div className="final-list">
              {registrationEntities.length === 0 ? (
                <p className="empty-state">No hay registros a feria.</p>
              ) : (
                registrationEntities.map((entity) => (
                  <EntityCard entity={entity} key={entity.entityKey} />
                ))
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Decisiones</p>
                <h2>municipality_decision / fair_event_decision</h2>
              </div>
              <span className="status-pill">
                {decisionEntities.length} decisions
              </span>
            </div>

            <div className="final-list">
              {decisionEntities.length === 0 ? (
                <p className="empty-state">No hay decisiones cargadas.</p>
              ) : (
                decisionEntities.map((entity) => (
                  <EntityCard entity={entity} key={entity.entityKey} />
                ))
              )}
            </div>
          </div>
        </section>

        <section className="grid-layout bottom-grid">
          {renderEntitiesPanel("Todas las entidades Arkiv")}
        </section>
      </>
    );
  }

  if (!authUsuario) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <main className="app-shell">
      {renderHeader()}
{errorMessage && <div className="error-banner">{errorMessage}</div>}

      {renderStats()}

      {canAccessSectionByRole(getAuthToken(), "entrepreneur" as AppSection) && activeSection === "entrepreneur" && renderEntrepreneurPanel()}
      {canAccessSectionByRole(getAuthToken(), "fair_organizer" as AppSection) && activeSection === "fair_organizer" && renderFairOrganizerPanel()}
      {activeSection === "municipality" && renderMunicipalidadPanel()}
      {canAccessSectionByRole(getAuthToken(), "all" as AppSection) && activeSection === "all" && renderAllPanel()}
    </main>
  );
}

export default App;

