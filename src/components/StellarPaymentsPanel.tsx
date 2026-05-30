import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  backendCreateStellarPaymentIntent,
  backendListStellarPayments,
  backendVerifyStellarPayment,
  type StellarPayment,
} from "../services/backendApi";
import type { LocalArkivEntity } from "../types/feria";

function getEntityType(entity: LocalArkivEntity<unknown>): string {
  const attr = entity.attributes.find((item) => item.key === "entityType");
  return String(attr?.value ?? "");
}

function getPayload(entity: LocalArkivEntity<unknown>): Record<string, unknown> {
  if (entity.payload && typeof entity.payload === "object") {
    return entity.payload as Record<string, unknown>;
  }

  return {};
}

function getUserDocumentFromToken(token: string | null): string {
  if (!token) return "";

  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const parsed = JSON.parse(atob(normalized)) as {
      document?: string;
      sub?: string;
    };

    return String(parsed.document ?? parsed.sub ?? "");
  } catch {
    return "";
  }
}

function getRegistrationFairKey(entity: LocalArkivEntity<unknown>) {
  const payload = getPayload(entity);
  return String(payload.fairKey ?? payload.fairId ?? "");
}

function getRegistrationLabel(entity: LocalArkivEntity<unknown>) {
  const payload = getPayload(entity);

  const fairName = String(payload.fairName ?? "Feria");
  const businessName = String(
    payload.businessName ??
      payload.ventureName ??
      payload.standName ??
      "Emprendimiento"
  );

  return `${fairName} - ${businessName}`;
}

function getRegistrationPayment(
  payments: StellarPayment[],
  registrationKey: string
) {
  const related = payments.filter(
    (payment) => payment.registrationKey === registrationKey
  );

  const confirmed = related.find((payment) => payment.status === "CONFIRMED");
  if (confirmed) {
    return {
      status: "CONFIRMED" as const,
      payment: confirmed,
      related,
    };
  }

  const pending = related.find((payment) => payment.status === "PENDING");
  if (pending) {
    return {
      status: "PENDING" as const,
      payment: pending,
      related,
    };
  }

  return {
    status: "UNPAID" as const,
    payment: null,
    related,
  };
}

function getPaymentStatusLabel(status: "CONFIRMED" | "PENDING" | "UNPAID") {
  if (status === "CONFIRMED") return "CONFIRMADO";
  if (status === "PENDING") return "PENDIENTE";
  return "SIN PAGO";
}

function buildStellarPayUri(payment: StellarPayment) {
  const params = new URLSearchParams();

  params.set("destination", payment.receiverPublicKey);
  params.set("amount", payment.amountXlm);
  params.set("asset_code", "XLM");
  params.set("memo", payment.memo);
  params.set("memo_type", "MEMO_TEXT");
  params.set("network_passphrase", payment.network === "PUBLIC" ? "Public Global Stellar Network ; September 2015" : "Test SDF Network ; September 2015");

  return `web+stellar:pay?${params.toString()}`;
}

export function StellarPaymentsPanel(props: {
  token: string | null;
  entities: LocalArkivEntity<unknown>[];
  onPaymentConfirmed?: () => void | Promise<void>;
}) {
  const [payments, setPayments] = useState<StellarPayment[]>([]);
  const [selectedRegistrationKey, setSelectedRegistrationKey] = useState("");
  const [activePayment, setActivePayment] = useState<StellarPayment | null>(null);
  const [txHash, setTxHash] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const userDocument = getUserDocumentFromToken(props.token);

  const myRegistrations = useMemo(() => {
    return props.entities
      .filter((entity) => getEntityType(entity) === "fair_registration")
      .filter((entity) => {
        const payload = getPayload(entity);
        const document = String(
          payload.entrepreneurDocument ??
            payload.documentNumber ??
            payload.document ??
            ""
        );

        return !userDocument || document === userDocument;
      });
  }, [props.entities, userDocument]);

  const selectedRegistration = useMemo(() => {
    return (
      myRegistrations.find(
        (entity) => entity.entityKey === selectedRegistrationKey
      ) ?? null
    );
  }, [myRegistrations, selectedRegistrationKey]);

  const selectedPaymentState = useMemo(() => {
    if (!selectedRegistrationKey) {
      return {
        status: "UNPAID" as const,
        payment: null,
        related: [],
      };
    }

    return getRegistrationPayment(payments, selectedRegistrationKey);
  }, [payments, selectedRegistrationKey]);

  const visiblePayments = useMemo(() => {
    return payments.filter((payment) => payment.status !== "EXPIRED");
  }, [payments]);

  const activePaymentUri = useMemo(() => {
    return activePayment ? buildStellarPayUri(activePayment) : "";
  }, [activePayment]);

  async function loadPayments() {
    if (!props.token) return;

    const data = await backendListStellarPayments({
      token: props.token,
    });

    setPayments(data);

    if (!selectedRegistrationKey && myRegistrations.length > 0) {
      setSelectedRegistrationKey(myRegistrations[0].entityKey);
      return;
    }

    if (selectedRegistrationKey) {
      const state = getRegistrationPayment(data, selectedRegistrationKey);
      setActivePayment(state.payment);
    }
  }

  useEffect(() => {
    if (!selectedRegistrationKey && myRegistrations.length > 0) {
      setSelectedRegistrationKey(myRegistrations[0].entityKey);
    }
  }, [myRegistrations, selectedRegistrationKey]);

  useEffect(() => {
    void loadPayments();
  }, [props.token, myRegistrations.length, selectedRegistrationKey]);

  useEffect(() => {
    setActivePayment(selectedPaymentState.payment);
  }, [selectedPaymentState.payment]);

  async function handleCreateIntent() {
    if (!props.token) return;

    if (!selectedRegistration) {
      setMessage("Primero seleccioná una inscripción.");
      return;
    }

    if (selectedPaymentState.status === "CONFIRMED") {
      setMessage("Esta inscripción ya tiene un pago confirmado.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const payment = await backendCreateStellarPaymentIntent({
        token: props.token,
        registrationKey: selectedRegistration.entityKey,
        fairKey: getRegistrationFairKey(selectedRegistration) || undefined,
      });

      setActivePayment(payment);
      await loadPayments();

      if (payment.status === "CONFIRMED") {
        setMessage("Esta inscripción ya tenía un pago confirmado.");
      } else {
        setMessage(
          "Escaneá el QR con una wallet Stellar compatible o usá los datos manuales. Luego pegá el hash para verificar."
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo crear la intención de pago."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyPayment() {
    if (!props.token || !activePayment) return;

    setIsLoading(true);
    setMessage("");

    try {
      const verified = await backendVerifyStellarPayment({
        token: props.token,
        paymentIntentId: activePayment.id,
        txHash,
      });

      setActivePayment(verified);
      await loadPayments();
      await props.onPaymentConfirmed?.();
      setTxHash("");
      setMessage("Pago confirmado correctamente en Stellar.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo verificar el pago en Stellar."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function copyPaymentUri() {
    if (!activePaymentUri) return;

    await navigator.clipboard.writeText(activePaymentUri);
    setMessage("Link de pago Stellar copiado.");
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">STELLAR TESTNET</p>
          <h2>Pago de inscripción con Stellar</h2>
        </div>
        <span className="status-pill">Testnet</span>
      </div>

      <p className="empty-state">
        Seleccioná una inscripción, generá la intención de pago y escaneá el QR con una wallet
        Stellar compatible. El QR incluye destino, monto y memo obligatorio.
      </p>

      {myRegistrations.length === 0 ? (
        <div className="entity-card">
          Todavía no tenés inscripciones para pagar.
        </div>
      ) : (
        <>
          <div className="form-grid">
            <label>
              Inscripción
              <select
                value={selectedRegistrationKey}
                onChange={(event) => {
                  setSelectedRegistrationKey(event.target.value);
                  setTxHash("");
                  setMessage("");
                }}
              >
                {myRegistrations.map((entity) => {
                  const state = getRegistrationPayment(payments, entity.entityKey);

                  return (
                    <option key={entity.entityKey} value={entity.entityKey}>
                      {getRegistrationLabel(entity)} · {getPaymentStatusLabel(state.status)}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>

          <div className="entity-card">
            <div className="entity-card-header">
              <strong>Estado de pago de la inscripción</strong>
              <span className="status-pill">
                {getPaymentStatusLabel(selectedPaymentState.status)}
              </span>
            </div>

            {selectedRegistration ? (
              <small className="mono">
                Inscripción: {selectedRegistration.entityKey}
              </small>
            ) : null}
          </div>

          <div className="actions">
            <button
              type="button"
              onClick={handleCreateIntent}
              disabled={
                isLoading ||
                !props.token ||
                !selectedRegistration ||
                selectedPaymentState.status === "CONFIRMED"
              }
            >
              {selectedPaymentState.status === "CONFIRMED"
                ? "Pago confirmado"
                : isLoading
                  ? "Procesando..."
                  : selectedPaymentState.status === "PENDING"
                    ? "Ver QR de pago"
                    : "Generar pago Stellar"}
            </button>
          </div>
        </>
      )}

      {activePayment ? (
        <div className="entity-card">
          <div className="entity-card-header">
            <strong>Instrucciones de pago</strong>
            <span className="status-pill">{activePayment.status}</span>
          </div>

          <div className="stellar-payment-layout">
            <div className="stellar-qr-card">
              <QRCodeSVG value={activePaymentUri} size={220} includeMargin />
              <strong>Escanear para pagar</strong>
              <small>
                Compatible con wallets que soporten SEP-0007 / web+stellar.
              </small>
              <button type="button" className="ghost" onClick={copyPaymentUri}>
                Copiar link de pago
              </button>
            </div>

            <dl className="entity-details">
              <dt>Concepto</dt>
              <dd>{activePayment.paymentConcept ?? "ENTREPRENEUR_REGISTRATION_FEE"}</dd>

              <dt>Cobra</dt>
              <dd>
                {activePayment.payeeRole ?? "MUNICIPALITY"}
                {activePayment.payeeName ? ` · ${activePayment.payeeName}` : ""}
              </dd>

              <dt>Red</dt>
              <dd>{activePayment.network}</dd>

              <dt>Monto</dt>
              <dd>
                {activePayment.amountXlm} {activePayment.assetCode}
              </dd>

              <dt>Cuenta destino</dt>
              <dd className="mono">{activePayment.receiverPublicKey}</dd>

              <dt>Memo obligatorio</dt>
              <dd className="mono">{activePayment.memo}</dd>

              {activePayment.txHash ? (
                <>
                  <dt>Tx Hash</dt>
                  <dd className="mono">{activePayment.txHash}</dd>
                </>
              ) : null}

              {activePayment.confirmedAt ? (
                <>
                  <dt>Confirmado</dt>
                  <dd>{new Date(activePayment.confirmedAt).toLocaleString()}</dd>
                </>
              ) : null}
            </dl>
          </div>

          {activePayment.status !== "CONFIRMED" ? (
            <>
              <label>
                Hash de transacción Stellar
                <input
                  value={txHash}
                  onChange={(event) => setTxHash(event.target.value)}
                  placeholder="Pegá el hash de 64 caracteres"
                />
              </label>

              <div className="actions">
                <button
                  type="button"
                  onClick={handleVerifyPayment}
                  disabled={isLoading || txHash.trim().length < 20}
                >
                  Verificar pago
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {visiblePayments.length > 0 ? (
        <div className="final-list">
          {visiblePayments.map((payment) => (
            <div className="entity-card" key={payment.id}>
              <div className="entity-card-header">
                <strong>{payment.amountXlm} XLM</strong>
                <span className="status-pill">{payment.status}</span>
              </div>
              <small className="mono">
                {payment.registrationKey ? `Inscripción: ${payment.registrationKey}` : "Sin inscripción asociada"}
              </small>
              <small className="mono">{payment.memo}</small>
            </div>
          ))}
        </div>
      ) : null}

      {message ? <p className="empty-state">{message}</p> : null}
    </section>
  );
}

