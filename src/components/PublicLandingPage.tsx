import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import logoSrc from "../assets/logoferiagrande.png";
import {
  backendListApprovedPublicFairs,
  backendSendContact,
  type ContactPayload,
  type PublicFairSummary,
} from "../services/backendApi";
import { FairsMap } from "./FairsMap";

const SPONSORS = [
  {
    id: "muni",
    name: "Municipalidad de Salta",
    category: "Gobierno Municipal",
    description: "Apoyo institucional al emprendedorismo local y gestión de ferias urbanas.",
    icon: "🏛️",
  },
  {
    id: "mdp",
    name: "Min. Desarrollo Productivo",
    category: "Gobierno Provincial",
    description: "Fomento de la producción, el empleo y la innovación en la provincia.",
    icon: "📊",
  },
  {
    id: "ccs",
    name: "Cámara de Comercio de Salta",
    category: "Entidad Privada",
    description: "Representando al comercio salteño y apoyando el crecimiento empresarial.",
    icon: "🤝",
  },
  {
    id: "inti",
    name: "INTI Salta",
    category: "Instituto Nacional",
    description: "Tecnología, innovación e industria al servicio del desarrollo regional.",
    icon: "🔬",
  },
  {
    id: "unsa",
    name: "Universidad Nacional de Salta",
    category: "Academia",
    description: "Formación, investigación y transferencia tecnológica para la región.",
    icon: "🎓",
  },
  {
    id: "macro",
    name: "Banco Macro",
    category: "Sector Financiero",
    description: "Financiamiento y créditos accesibles para emprendedores y pymes.",
    icon: "🏦",
  },
];

const TIPO_CONSULTA_OPTIONS = [
  "Inscribirse a una feria",
  "Información sobre ferias disponibles",
  "Ser sponsor de FerIA",
  "Consulta general",
  "Otro",
];

const EMPTY_FORM: ContactPayload = {
  nombre: "",
  email: "",
  telefono: "",
  municipio: "",
  tipoConsulta: "",
  mensaje: "",
};

function LandingNav({ onLoginClick }: { onLoginClick: () => void }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 30);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function goTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav className={`lv2-nav${scrolled ? " lv2-nav--scrolled" : ""}`}>
      <button type="button" className="lv2-nav__brand" onClick={() => goTo("lv2-inicio")}>
        <img src={logoSrc} alt="FerIA" />
        <span>FerIA</span>
      </button>

      <div className="lv2-nav__links">
        {(["lv2-inicio", "lv2-ferias", "lv2-emprendedores", "lv2-sponsors", "lv2-contacto"] as const).map((id) => {
          const label = id.replace("lv2-", "");
          return (
            <button
              key={id}
              type="button"
              className="lv2-nav__link"
              onClick={() => goTo(id)}
            >
              {label.charAt(0).toUpperCase() + label.slice(1)}
            </button>
          );
        })}
      </div>

      <button type="button" className="lv2-nav__cta" onClick={onLoginClick}>
        Ingresar →
      </button>
    </nav>
  );
}

export function PublicLandingPage() {
  const [fairs, setFairs] = useState<PublicFairSummary[]>([]);
  const [selectedFairKey, setSelectedFairKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [form, setForm] = useState<ContactPayload>(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [contactResult, setContactResult] = useState<"idle" | "ok" | "error">("idle");
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const data = await backendListApprovedPublicFairs();
        setFairs(data);
        if (data.length > 0) setSelectedFairKey(data[0].fairKey);
      } catch {
        /* silently degrade */
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  const totalEntrepreneurs = useMemo(
    () => fairs.reduce((acc, f) => acc + f.registeredCount, 0),
    [fairs]
  );

  const allEntrepreneurs = useMemo(
    () =>
      fairs.flatMap((fair) =>
        fair.entrepreneurs.map((e) => ({ ...e, fairName: fair.fairName }))
      ),
    [fairs]
  );

  const uniqueRubros = useMemo(
    () => new Set(allEntrepreneurs.map((e) => e.category).filter(Boolean)).size,
    [allEntrepreneurs]
  );

  const fairsWithSlots = useMemo(
    () => fairs.filter((f) => f.availableSlots != null && f.availableSlots > 0).length,
    [fairs]
  );

  function goTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setField(key: keyof ContactPayload, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleContactSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setContactResult("idle");
    try {
      await backendSendContact(form);
      setContactResult("ok");
      setForm(EMPTY_FORM);
    } catch {
      setContactResult("error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="lv2">
      <LandingNav onLoginClick={() => navigate("/login")} />

      {/* ── HERO ── */}
      <section id="lv2-inicio" className="lv2-hero">
        <div className="lv2-hero__content">
          <p className="lv2-eyebrow">Plataforma digital · Salta · 2025</p>
          <h1 className="lv2-hero__title">
            Fer<span>IA</span>
          </h1>
          <p className="lv2-hero__subtitle">
            Asistente digital para emprendedores de Salta.<br />
            Un solo lugar. Tres problemas resueltos.
          </p>

          <div className="lv2-hero__stats">
            <div className="lv2-hero__stat">
              <strong>{isLoading ? "—" : fairs.length}</strong>
              <span>Ferias aprobadas</span>
            </div>
            <div className="lv2-hero__stat">
              <strong>{isLoading ? "—" : totalEntrepreneurs}</strong>
              <span>Emprendedores</span>
            </div>
            <div className="lv2-hero__stat">
              <strong>1</strong>
              <span>Municipio</span>
            </div>
          </div>

          <div className="lv2-hero__actions">
            <button type="button" className="lv2-btn-primary" onClick={() => goTo("lv2-ferias")}>
              Explorar ferias
            </button>
            <button type="button" className="lv2-btn-ghost" onClick={() => navigate("/login")}>
              Ingresar al sistema →
            </button>
          </div>
        </div>

        <div className="lv2-hero__visual">
          <div className="lv2-hero__logo-card">
            <img src={logoSrc} alt="FerIA logo" />
          </div>
          <div className="lv2-feature-pill lv2-feature-pill--1">🗺️ Mapa interactivo</div>
          <div className="lv2-feature-pill lv2-feature-pill--2">🔒 Blockchain Arkiv</div>
          <div className="lv2-feature-pill lv2-feature-pill--3">💳 Pagos Stellar</div>
        </div>
      </section>

      <div className="lv2-wave" aria-hidden="true">
        <svg viewBox="0 0 1440 72" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0,36 C360,72 1080,0 1440,36 L1440,72 L0,72 Z" fill="#f5f7fa" />
        </svg>
      </div>

      {/* ── FERIAS ── */}
      <section id="lv2-ferias" className="lv2-section">
        <div className="lv2-section__header">
          <p className="lv2-eyebrow-dark">Ferias disponibles</p>
          <h2>Ferias Aprobadas en Salta</h2>
          <p className="lv2-section__subtitle">
            Encontrá las ferias habilitadas, su ubicación y los emprendedores que participan.
          </p>
        </div>

        {isLoading ? (
          <div className="lv2-loading-card">Cargando ferias...</div>
        ) : fairs.length === 0 ? (
          <div className="lv2-empty-card">No hay ferias aprobadas disponibles en este momento.</div>
        ) : (
          <div className="lv2-fairs-layout">
            <div className="lv2-card lv2-map-card">
              <FairsMap
                fairs={fairs}
                selectedFairKey={selectedFairKey}
                onSelectFair={setSelectedFairKey}
              />
            </div>
            <div className="lv2-fairs-list">
              <p className="lv2-fairs-list__title">{fairs.length} ferias activas</p>
              {fairs.map((fair) => (
                <button
                  key={fair.fairKey}
                  type="button"
                  className={`lv2-fair-item${fair.fairKey === selectedFairKey ? " active" : ""}`}
                  onClick={() => setSelectedFairKey(fair.fairKey)}
                >
                  <div className="lv2-fair-item__dot" />
                  <div className="lv2-fair-item__body">
                    <strong>{fair.fairName}</strong>
                    <span>{fair.locationName || fair.address || "Ubicación no informada"}</span>
                    <small>
                      {fair.registeredCount} emprendedor{fair.registeredCount !== 1 ? "es" : ""}
                      {fair.availableSlots != null ? ` · ${fair.availableSlots} cupos` : ""}
                    </small>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── EMPRENDEDORES ── */}
      <section id="lv2-emprendedores" className="lv2-section lv2-section--alt">
        <div className="lv2-section__header">
          <p className="lv2-eyebrow-dark">Comunidad</p>
          <h2>Emprendedores Inscriptos</h2>
          <p className="lv2-section__subtitle">
            Conocé a los emprendedores que forman parte de las ferias de Salta.
          </p>
        </div>

        <div className="lv2-stats-bar">
          <div className="lv2-stats-bar__item">
            <strong>{fairs.length}</strong>
            <span>Ferias activas</span>
          </div>
          <div className="lv2-stats-bar__item">
            <strong>{totalEntrepreneurs}</strong>
            <span>Emprendedores</span>
          </div>
          <div className="lv2-stats-bar__item">
            <strong>{fairsWithSlots}</strong>
            <span>Ferias con cupos</span>
          </div>
          <div className="lv2-stats-bar__item">
            <strong>{uniqueRubros}</strong>
            <span>Rubros distintos</span>
          </div>
        </div>

        {allEntrepreneurs.length === 0 ? (
          <div className="lv2-empty-card">No hay emprendedores inscriptos para mostrar.</div>
        ) : (
          <div className="lv2-entrepreneurs-grid">
            {allEntrepreneurs.slice(0, 12).map((e) => (
              <div key={e.registrationKey} className="lv2-entrepreneur-card">
                <div className="lv2-entrepreneur-card__avatar">
                  {(e.entrepreneurName || e.businessName || "?").charAt(0).toUpperCase()}
                </div>
                <div className="lv2-entrepreneur-card__info">
                  <strong>{e.entrepreneurName || "Emprendedor"}</strong>
                  <span>{e.businessName || "Emprendimiento"}</span>
                  {e.category ? <small>{e.category}</small> : null}
                  <small className="lv2-entrepreneur-card__fair">📍 {e.fairName}</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── SPONSORS ── */}
      <section id="lv2-sponsors" className="lv2-section">
        <div className="lv2-section__header">
          <p className="lv2-eyebrow-dark">Alianzas</p>
          <h2>Nuestros Sponsors</h2>
          <p className="lv2-section__subtitle">
            Instituciones y organizaciones que hacen posible FerIA en Salta.
          </p>
        </div>

        <div className="lv2-sponsors-grid">
          {SPONSORS.map((sponsor) => (
            <div key={sponsor.id} className="lv2-sponsor-card">
              <div className="lv2-sponsor-card__icon">{sponsor.icon}</div>
              <div className="lv2-sponsor-card__body">
                <span>{sponsor.category}</span>
                <strong>{sponsor.name}</strong>
                <p>{sponsor.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CONTACTO ── */}
      <section id="lv2-contacto" className="lv2-contacto">
        <div className="lv2-contacto__inner">
          <div className="lv2-contacto__info">
            <p className="lv2-eyebrow">Contacto</p>
            <h2>¿Querés participar?</h2>
            <p>
              Completá el formulario y nos ponemos en contacto a la brevedad.
            </p>
            <ul className="lv2-contacto__features">
              <li>✅ Inscripción a ferias aprobadas</li>
              <li>✅ Certificados verificables en blockchain</li>
              <li>✅ Pagos seguros con Stellar</li>
              <li>✅ Asistencia digital para emprendedores</li>
            </ul>
          </div>

          <div className="lv2-contacto__form-card">
            {contactResult === "ok" ? (
              <div className="lv2-contacto__success">
                <div className="lv2-contacto__success-icon">✅</div>
                <h3>¡Mensaje enviado!</h3>
                <p>Gracias por contactarnos. Te responderemos a la brevedad.</p>
                <button type="button" onClick={() => setContactResult("idle")}>
                  Enviar otro mensaje
                </button>
              </div>
            ) : (
              <form className="lv2-contacto__form" onSubmit={handleContactSubmit}>
                <div className="lv2-form-row">
                  <label>
                    Nombre y apellido *
                    <input
                      value={form.nombre}
                      onChange={(e) => setField("nombre", e.target.value)}
                      placeholder="Juan García"
                      required
                    />
                  </label>
                  <label>
                    Email *
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setField("email", e.target.value)}
                      placeholder="juan@ejemplo.com"
                      required
                    />
                  </label>
                </div>
                <div className="lv2-form-row">
                  <label>
                    Teléfono
                    <input
                      value={form.telefono}
                      onChange={(e) => setField("telefono", e.target.value)}
                      placeholder="0387 4xx xxxx"
                    />
                  </label>
                  <label>
                    Municipio *
                    <input
                      value={form.municipio}
                      onChange={(e) => setField("municipio", e.target.value)}
                      placeholder="Salta Capital"
                      required
                    />
                  </label>
                </div>
                <label>
                  Tipo de consulta *
                  <select
                    value={form.tipoConsulta}
                    onChange={(e) => setField("tipoConsulta", e.target.value)}
                    required
                  >
                    <option value="">Seleccioná una opción…</option>
                    {TIPO_CONSULTA_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Mensaje *
                  <textarea
                    value={form.mensaje}
                    onChange={(e) => setField("mensaje", e.target.value)}
                    placeholder="Contanos tu consulta..."
                    required
                  />
                </label>
                {contactResult === "error" && (
                  <p className="lv2-contacto__error">
                    No se pudo enviar el mensaje. Intentá nuevamente.
                  </p>
                )}
                <button type="submit" disabled={sending}>
                  {sending ? "Enviando…" : "Enviar consulta"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lv2-footer">
        <div className="lv2-footer__inner">
          <div className="lv2-footer__brand">
            <img src={logoSrc} alt="FerIA" />
            <span>FerIA</span>
          </div>
          <nav className="lv2-footer__links">
            {(["lv2-inicio", "lv2-ferias", "lv2-emprendedores", "lv2-sponsors", "lv2-contacto"] as const).map((id) => {
              const label = id.replace("lv2-", "");
              return (
                <button key={id} type="button" onClick={() => goTo(id)}>
                  {label.charAt(0).toUpperCase() + label.slice(1)}
                </button>
              );
            })}
          </nav>
          <p className="lv2-footer__copy">
            © 2025 FerIA · PunaTech Hackathon · Arkiv Track
          </p>
        </div>
      </footer>
    </div>
  );
}
