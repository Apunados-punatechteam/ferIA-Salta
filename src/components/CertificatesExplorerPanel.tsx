import { useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import type { LocalArkivEntity } from "../types/feria";

type CertificatePayload = {
  certificateNumber?: string;
  fairKey?: string;
  registrationKey?: string;
  fairName?: string;
  entrepreneurName?: string;
  entrepreneurDocument?: string;
  businessName?: string;
  status?: string;
  issuedAt?: number;
  txHash?: string;
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

function shortKey(value: string): string {
  if (!value) return "-";
  if (value.length <= 26) return value;
  return `${value.slice(0, 12)}...${value.slice(-10)}`;
}

export function CertificatesExplorerPanel({
  entities,
  entrepreneurDocument,
  title = "Certificados",
  subtitle = "Listado completo de certificados verificables.",
  showAll = false,
}: {
  entities: LocalArkivEntity<unknown>[];
  entrepreneurDocument?: string;
  title?: string;
  subtitle?: string;
  showAll?: boolean;
}) {
  const certificates = useMemo(() => {
    return entities
      .filter((entity) => getEntityType(entity) === "fair_certificate")
      .filter((entity) => {
        if (showAll) return true;

        const payload = getPayload<CertificatePayload>(entity);
        return String(payload.entrepreneurDocument ?? "") === String(entrepreneurDocument ?? "");
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [entities, entrepreneurDocument, showAll]);

  const [selectedCertificateKey, setSelectedCertificateKey] = useState(
    certificates[0]?.entityKey ?? ""
  );

  const selectedCertificate =
    certificates.find((item) => item.entityKey === selectedCertificateKey) ??
    certificates[0] ??
    null;

  const selectedPayload = selectedCertificate
    ? getPayload<CertificatePayload>(selectedCertificate)
    : null;

  const qrValue = JSON.stringify({
    type: "fair_certificate",
    certificateNumber: selectedPayload?.certificateNumber ?? "",
    entrepreneurName: selectedPayload?.entrepreneurName ?? "",
    entrepreneurDocument: selectedPayload?.entrepreneurDocument ?? "",
    businessName: selectedPayload?.businessName ?? "",
    fairName: selectedPayload?.fairName ?? "",
    fairKey: selectedPayload?.fairKey ?? "",
    registrationKey: selectedPayload?.registrationKey ?? "",
    certificateKey: selectedCertificate?.entityKey ?? "",
    txHash: selectedPayload?.txHash ?? "",
    verifier: "FerIA - Arkiv",
  });

  return (
    <section className="panel certificates-explorer-panel">
      <div className="panel-header certificates-explorer-header">
        <div>
          <p className="eyebrow">Certificados</p>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span className="status-pill">{certificates.length} certificados</span>
      </div>

      {certificates.length === 0 ? (
        <p className="empty-state">Todavia no hay certificados emitidos.</p>
      ) : (
        <div className="certificates-explorer-layout-v2">
          <aside className="certificates-explorer-list-v2">
            {certificates.map((entity) => {
              const payload = getPayload<CertificatePayload>(entity);
              const isActive = selectedCertificate?.entityKey === entity.entityKey;

              return (
                <button
                  type="button"
                  key={entity.entityKey}
                  className={isActive ? "certificate-row-v2 active" : "certificate-row-v2"}
                  onClick={() => setSelectedCertificateKey(entity.entityKey)}
                >
                  <span>
                    <strong>{payload.certificateNumber ?? "Certificado"}</strong>
                    <small>
                      {payload.fairName ?? "Feria"} - {formatDate(payload.issuedAt ?? entity.createdAt)}
                    </small>
                  </span>

                  <em>Ver</em>
                </button>
              );
            })}
          </aside>

          {selectedCertificate && selectedPayload && (
            <article className="certificate-detail-card-v2">
              <div className="certificate-detail-card-v2__main">
                <div className="certificate-detail-card-v2__title">
                  <p className="eyebrow">Certificado seleccionado</p>
                  <h3>{selectedPayload.certificateNumber ?? "Certificado"}</h3>
                  <p>{selectedPayload.fairName ?? "Feria sin nombre"}</p>
                </div>

                <div className="certificate-detail-grid-v2">
                  <div>
                    <span>Emprendedor</span>
                    <strong>{selectedPayload.entrepreneurName ?? "-"}</strong>
                  </div>

                  <div>
                    <span>DNI / CUIT</span>
                    <strong>{selectedPayload.entrepreneurDocument ?? "-"}</strong>
                  </div>

                  <div>
                    <span>Emprendimiento</span>
                    <strong>{selectedPayload.businessName ?? "-"}</strong>
                  </div>

                  <div>
                    <span>Feria</span>
                    <strong>{selectedPayload.fairName ?? "-"}</strong>
                  </div>

                  <div>
                    <span>Fecha de emision</span>
                    <strong>{formatDate(selectedPayload.issuedAt ?? selectedCertificate.createdAt)}</strong>
                  </div>

                  <div>
                    <span>Estado</span>
                    <strong>{selectedPayload.status ?? "issued"}</strong>
                  </div>

                  <div className="span-full">
                    <span>Entidad certificado Arkiv</span>
                    <strong>{selectedCertificate.entityKey}</strong>
                  </div>

                  {selectedPayload.registrationKey && (
                    <div className="span-full">
                      <span>Registro Arkiv</span>
                      <strong>{selectedPayload.registrationKey}</strong>
                    </div>
                  )}

                  {selectedPayload.txHash && (
                    <div className="span-full">
                      <span>Tx hash</span>
                      <strong>{selectedPayload.txHash}</strong>
                    </div>
                  )}
                </div>
              </div>

              <aside className="certificate-detail-card-v2__qr">
                <div className="qr-box-v2">
                  <QRCodeCanvas value={qrValue} size={210} level="M" includeMargin />
                  <h4>QR verificable</h4>
                  <p>{shortKey(selectedCertificate.entityKey)}</p>
                </div>
              </aside>
            </article>
          )}
        </div>
      )}
    </section>
  );
}