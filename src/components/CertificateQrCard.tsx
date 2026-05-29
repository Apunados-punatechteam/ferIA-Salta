import { QRCodeCanvas } from "qrcode.react";

export function CertificateQrCard({
  certificateNumber,
  entrepreneurName,
  businessName,
  fairName,
  fairKey,
  registrationKey,
  certificateKey,
  txHash,
  remainingSlots,
}: {
  certificateNumber?: string;
  entrepreneurName?: string;
  businessName?: string;
  fairName?: string;
  fairKey?: string;
  registrationKey?: string;
  certificateKey?: string;
  txHash?: string;
  remainingSlots?: number;
}) {
  const qrValue = JSON.stringify({
    type: "fair_certificate",
    certificateNumber: certificateNumber ?? "",
    entrepreneurName: entrepreneurName ?? "",
    businessName: businessName ?? "",
    fairName: fairName ?? "",
    fairKey: fairKey ?? "",
    registrationKey: registrationKey ?? "",
    certificateKey: certificateKey ?? "",
    txHash: txHash ?? "",
    verifier: "FerIA - Arkiv",
  });

  return (
    <article className="certificate-final-card">
      <div className="certificate-final-card__info">
        <p className="eyebrow">Certificado emitido</p>

        <h3>{certificateNumber || "Certificado sin numero"}</h3>

        <p>{entrepreneurName || "Emprendedor"}</p>
        <p>{businessName || "Emprendimiento"}</p>
        <p>{fairName || "Feria"}</p>

        <div className="certificate-final-card__key">
          <span>Registro Arkiv</span>
          <strong>{registrationKey || "-"}</strong>
        </div>

        <div className="certificate-final-card__key">
          <span>Certificado Arkiv</span>
          <strong>{certificateKey || "-"}</strong>
        </div>

        {txHash && (
          <div className="certificate-final-card__key">
            <span>Tx hash</span>
            <strong>{txHash}</strong>
          </div>
        )}

        <div className="certificate-final-card__key">
          <span>Cupos restantes</span>
          <strong>{String(remainingSlots ?? "-")}</strong>
        </div>
      </div>

      <div className="certificate-final-card__qr">
        <QRCodeCanvas value={qrValue} size={150} level="M" includeMargin />
        <span>QR verificable</span>
      </div>
    </article>
  );
}