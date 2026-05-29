import { type FormEvent, useMemo, useState } from "react";
import {
  backendCreateFairRegistration,
  type BackendFairRegistrationResponse,
} from "../services/backendApi";
import type { LocalArkivEntity } from "../types/feria";
import { CertificateQrCard } from "./CertificateQrCard";

type FairPayload = {
  name?: string;
  address?: string;
  category?: string;
  availableSlots?: number;
  description?: string;
};

type RegistrationPayload = {
  fairKey?: string;
  status?: string;
  businessName?: string;
};

type CancellationPayload = {
  registrationKey?: string;
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

function getActiveRegistrationCount(
  entities: LocalArkivEntity<unknown>[],
  fairKey: string
) {
  const cancelled = getCancellationSet(entities);

  return entities.filter((entity) => {
    if (getEntityType(entity) !== "fair_registration") return false;

    const payload = getPayload<RegistrationPayload>(entity);

    return (
      String(payload.fairKey ?? "") === fairKey &&
      String(payload.status ?? "active") === "active" &&
      !cancelled.has(entity.entityKey)
    );
  }).length;
}

function getRemainingSlots(
  entities: LocalArkivEntity<unknown>[],
  fair: LocalArkivEntity<unknown>
) {
  const payload = getPayload<FairPayload>(fair);
  const total = Number(payload.availableSlots ?? 0);
  const active = getActiveRegistrationCount(entities, fair.entityKey);

  return Math.max(total - active, 0);
}

export function EntrepreneurRegistrationPanel({
  token,
  entities,
  approvedFairEntities,
  onRegistered,
}: {
  token: string | null;
  entities: LocalArkivEntity<unknown>[];
  approvedFairEntities: LocalArkivEntity<unknown>[];
  onRegistered: () => Promise<void> | void;
}) {
  const [selectedFairKey, setSelectedFairKey] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [standPhoto, setStandPhoto] = useState<File | null>(null);
  const [articlePhotos, setArticlePhotos] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] =
    useState<BackendFairRegistrationResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedFair = useMemo(() => {
    return (
      approvedFairEntities.find((fair) => fair.entityKey === selectedFairKey) ??
      approvedFairEntities[0] ??
      null
    );
  }, [approvedFairEntities, selectedFairKey]);

  const selectedFairPayload = selectedFair
    ? getPayload<FairPayload>(selectedFair)
    : null;

  const remainingSlots = selectedFair
    ? getRemainingSlots(entities, selectedFair)
    : 0;

  function handleArticlePhotos(files: FileList | null) {
    if (!files) {
      setArticlePhotos([]);
      return;
    }

    setArticlePhotos(Array.from(files).slice(0, 3));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      alert("No hay token de sesion. Inicia sesion de nuevo.");
      return;
    }

    if (!selectedFair) {
      alert("No hay feria aprobada seleccionada.");
      return;
    }

    if (remainingSlots <= 0) {
      alert("No quedan cupos disponibles para esta feria.");
      return;
    }

    if (!standPhoto) {
      alert("La foto del stand es obligatoria.");
      return;
    }

    const formData = new FormData();
    formData.append("fairKey", selectedFair.entityKey);
    formData.append("businessName", businessName.trim() || "Emprendimiento");
    formData.append("phone", phone.trim());
    formData.append("description", description.trim());
    formData.append("standPhoto", standPhoto);

    for (const file of articlePhotos.slice(0, 3)) {
      formData.append("articlePhotos", file);
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const result = await backendCreateFairRegistration({
        token,
        formData,
      });

      setLastResult(result);
      await onRegistered();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo registrar la inscripcion.";

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
            <p className="eyebrow">Emprendedor</p>
            <h2>Inscripcion a feria aprobada</h2>
          </div>
          <span className="status-pill">
            {approvedFairEntities.length} ferias
          </span>
        </div>

        {errorMessage && <div className="error-banner">{errorMessage}</div>}

        {approvedFairEntities.length === 0 ? (
          <p className="empty-state">
            Todavia no hay ferias aprobadas disponibles. Sincroniza desde backend.
          </p>
        ) : (
          <form className="form-grid" onSubmit={handleSubmit}>
            <label className="span-2">
              Feria aprobada
              <select
                value={selectedFair?.entityKey ?? ""}
                onChange={(event) => setSelectedFairKey(event.target.value)}
              >
                {approvedFairEntities.map((fair) => {
                  const payload = getPayload<FairPayload>(fair);
                  const remaining = getRemainingSlots(entities, fair);

                  return (
                    <option value={fair.entityKey} key={fair.entityKey}>
                      {String(payload.name ?? "Feria")} - {remaining} cupos
                    </option>
                  );
                })}
              </select>
            </label>

            {selectedFair && (
              <div className="span-2 fair-selected-box">
                <strong>{selectedFairPayload?.name ?? "Feria"}</strong>
                <span>{selectedFairPayload?.address ?? "Sin direccion"}</span>
                <span>Rubro: {selectedFairPayload?.category ?? "-"}</span>
                <span>Cupos disponibles: {remainingSlots}</span>
              </div>
            )}

            <label>
              Nombre del emprendimiento
              <input
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                placeholder="Ej: Artesanias del Valle"
              />
            </label>

            <label>
              Telefono
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Ej: 387..."
              />
            </label>

            <label className="span-2">
              Descripcion de productos
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Contanos que vas a ofrecer en la feria"
              />
            </label>

            <label className="span-2">
              Foto del stand obligatoria
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  setStandPhoto(event.target.files?.[0] ?? null)
                }
              />
            </label>

            <label className="span-2">
              Fotos de articulos opcionales maximo 3
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => handleArticlePhotos(event.target.files)}
              />
            </label>

            <div className="span-2 upload-preview-grid">
              {standPhoto && (
                <div className="upload-preview-item">
                  <span>Stand</span>
                  <strong>{standPhoto.name}</strong>
                </div>
              )}

              {articlePhotos.map((file, index) => (
                <div className="upload-preview-item" key={file.name}>
                  <span>Articulo {index + 1}</span>
                  <strong>{file.name}</strong>
                </div>
              ))}
            </div>

            <div className="actions span-2">
              <button
                type="submit"
                disabled={isSubmitting || remainingSlots <= 0}
              >
                {remainingSlots <= 0
                  ? "Sin cupos"
                  : isSubmitting
                    ? "Inscribiendo..."
                    : "Inscribirme y emitir certificado"}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Resultado</p>
            <h2>Certificado final</h2>
          </div>
        </div>
        {!lastResult ? (
          <p className="empty-state">
            Todavia no hay inscripcion emitida en esta sesion.
          </p>
        ) : (
          <CertificateQrCard
            certificateNumber={lastResult.certificate.certificateNumber}
            entrepreneurName="Nicolas Mattioli"
            businessName={businessName || "Emprendimiento"}
            fairName={selectedFairPayload?.name ?? "Feria"}
            fairKey={selectedFair?.entityKey}
            registrationKey={lastResult.registration.entityKey}
            certificateKey={lastResult.certificate.entityKey}
            txHash={(lastResult.certificate as { txHash?: string }).txHash}
            remainingSlots={lastResult.remainingSlots}
          />
        )}
      </div>
    </section>
  );
}