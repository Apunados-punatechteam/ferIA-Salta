import { useEffect, useMemo, useState } from "react";
import feriaLogo from "../assets/feria-logo.jpeg";
import {
  backendListApprovedPublicFairs,
  type PublicFairSummary,
} from "../services/backendApi";
import { FairsMap } from "./FairsMap";

export function PublicLandingPage() {
  const [fairs, setFairs] = useState<PublicFairSummary[]>([]);
  const [selectedFairKey, setSelectedFairKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        setError("");

        const data = await backendListApprovedPublicFairs();
        setFairs(data);

        if (data.length > 0) {
          setSelectedFairKey(data[0].fairKey);
        }
      } catch (err) {
        setError("No se pudieron cargar las ferias en este momento. Intentá nuevamente en unos segundos.");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  const selectedFair = useMemo(() => {
    return fairs.find((item) => item.fairKey === selectedFairKey) ?? null;
  }, [fairs, selectedFairKey]);

  const totalEntrepreneurs = useMemo(() => {
    return fairs.reduce((acc, fair) => acc + fair.registeredCount, 0);
  }, [fairs]);

  function scrollToLogin() {
    document.getElementById("login-card")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <section className="landing-shell">
      <section className="landing-hero-card">
        <div className="landing-hero-left">
          <img src={feriaLogo} alt="FerIA" className="landing-logo" />

          <p className="landing-eyebrow">Plataforma digital para ferias y emprendedores</p>
          <h1 className="landing-title">
            FerIA
          </h1>
          <p className="landing-subtitle">
            Asistente digital para emprendedores de Salta. Consultá ferias aprobadas,
            visualizá ubicaciones en el mapa y conocé los emprendedores inscriptos.
          </p>

          <div className="landing-actions">
            <button type="button" onClick={scrollToLogin}>
              Ingresar al sistema
            </button>
          </div>
        </div>

        <div className="landing-stats-grid">
          <div className="landing-stat-card">
            <span>Ferias aprobadas</span>
            <strong>{fairs.length}</strong>
          </div>
          <div className="landing-stat-card">
            <span>Emprendedores inscriptos</span>
            <strong>{totalEntrepreneurs}</strong>
          </div>
          <div className="landing-stat-card">
            <span>Cobertura</span>
            <strong>Salta</strong>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-header">
          <div>
            <p className="landing-eyebrow">Mapa y ferias</p>
            <h2>Ferias disponibles aprobadas</h2>
          </div>
        </div>

        {isLoading ? (
          <div className="landing-empty-card">Cargando ferias aprobadas...</div>
        ) : error ? (
          <div className="landing-error-card">{error}</div>
        ) : fairs.length === 0 ? (
          <div className="landing-empty-card">No hay ferias aprobadas disponibles para mostrar.</div>
        ) : (
          <div className="landing-fairs-layout">
            <div className="landing-card">
              <h3>Mapa interactivo</h3>
              <FairsMap
                fairs={fairs}
                selectedFairKey={selectedFairKey}
                onSelectFair={setSelectedFairKey}
              />
            </div>

            <div className="landing-card">
              <h3>Listado de ferias</h3>
              <div className="landing-fairs-list">
                {fairs.map((fair) => {
                  const selected = fair.fairKey === selectedFairKey;

                  return (
                    <button
                      type="button"
                      key={fair.fairKey}
                      className={selected ? "landing-fair-item active" : "landing-fair-item"}
                      onClick={() => setSelectedFairKey(fair.fairKey)}
                    >
                      <strong>{fair.fairName}</strong>
                      <span>{fair.locationName || fair.address || "Ubicación no informada"}</span>
                      <small>
                        {fair.registeredCount} emprendedores
                        {fair.availableSlots !== null ? ` · ${fair.availableSlots} cupos disponibles` : ""}
                      </small>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="landing-section">
        <div className="landing-card">
          <div className="landing-section-header">
            <div>
              <p className="landing-eyebrow">Detalle</p>
              <h2>
                {selectedFair ? `Emprendedores inscriptos en ${selectedFair.fairName}` : "Emprendedores"}
              </h2>
            </div>
          </div>

          {selectedFair ? (
            <>
              <div className="landing-fair-summary">
                <div><strong>Ubicación:</strong> {selectedFair.locationName || selectedFair.address || "Sin dato"}</div>
                <div><strong>Fecha:</strong> {selectedFair.dateLabel || "Sin fecha informada"}</div>
                <div><strong>Inscriptos:</strong> {selectedFair.registeredCount}</div>
              </div>

              {selectedFair.entrepreneurs.length > 0 ? (
                <div className="landing-entrepreneurs-grid">
                  {selectedFair.entrepreneurs.map((item) => (
                    <div key={item.registrationKey} className="landing-entrepreneur-card">
                      <strong>{item.entrepreneurName || "Emprendedor sin nombre"}</strong>
                      <span>{item.businessName || "Emprendimiento sin nombre"}</span>
                      <small>{item.category || "Rubro no informado"}</small>
                      {item.phone ? <small>Tel: {item.phone}</small> : null}
                      {item.email ? <small>Email: {item.email}</small> : null}
                      {item.status ? <small>Estado: {item.status}</small> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="landing-empty-card">
                  La feria seleccionada todavía no tiene emprendedores inscriptos.
                </div>
              )}
            </>
          ) : (
            <div className="landing-empty-card">
              Seleccioná una feria para ver sus emprendedores inscriptos.
            </div>
          )}
        </div>
      </section>
    </section>
  );
}



