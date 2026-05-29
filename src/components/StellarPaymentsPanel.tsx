import { useEffect, useMemo, useState } from "react";
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

  async function loadPayments() {
    if (!props.token) return;

    const data = await backendListStellarPayments({
      token: props.token,
    });

    setPayments(data);

    const pending = data.find((payment) => payment.status === "PENDING");
    if (pending) {
      setActivePayment(pending);
      setSelectedRegistrationKey(pending.registrationKey ?? "");
    }
  }

  useEffect(() => {
    void loadPayments();
  }, [props.token]);

  async function handleCreateIntent() {
    if (!props.token) return;

    setIsLoading(true);
    setMessage("");

    try {
      const registration = myRegistrations.find(
        (entity) => entity.entityKey === selectedRegistrationKey
      );

      const payload = registration ? getPayload(registration) : {};

      const payment = await backendCreateStellarPaymentIntent({
        token: props.token,
        registrationKey: selectedRegistrationKey || undefined,
        fairKey: String(payload.fairKey ?? "") || undefined,
      });

      setActivePayment(payment);
      await loadPayments();
      setMessage(
        "Intención de pago creada. Realizá el pago en tu wallet Stellar y luego pegá el hash."
      );
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
        Generá una intención de pago, enviá XLM desde tu wallet Stellar usando el memo indicado
        y luego pegá el hash de la transacción para confirmar.
      </p>

      <div className="form-grid">
        <label>
          Inscripción
          <select
            value={selectedRegistrationKey}
            onChange={(event) => setSelectedRegistrationKey(event.target.value)}
          >
            <option value="">Pago general / sin inscripción asociada</option>
            {myRegistrations.map((entity) => {
              const payload = getPayload(entity);

              return (
                <option key={entity.entityKey} value={entity.entityKey}>
                  {String(payload.fairName ?? "Feria")} -{" "}
                  {String(payload.businessName ?? "Emprendimiento")}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      <div className="actions">
        <button type="button" onClick={handleCreateIntent} disabled={isLoading || !props.token}>
          {isLoading ? "Procesando..." : "Generar pago Stellar"}
        </button>
      </div>

      {activePayment ? (
        <div className="entity-card">
          <div className="entity-card-header">
            <strong>Instrucciones de pago</strong>
            <span className="status-pill">{activePayment.status}</span>
          </div>

          <dl className="entity-details">
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
          </dl>

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

      {payments.length > 0 ? (
        <div className="final-list">
          {payments.map((payment) => (
            <div className="entity-card" key={payment.id}>
              <div className="entity-card-header">
                <strong>{payment.amountXlm} XLM</strong>
                <span className="status-pill">{payment.status}</span>
              </div>
              <small className="mono">{payment.memo}</small>
            </div>
          ))}
        </div>
      ) : null}

      {message ? <p className="empty-state">{message}</p> : null}
    </section>
  );
}
