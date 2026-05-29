import { randomUUID } from "node:crypto";
import { env } from "./env.js";

export type StellarVerifiedPayment = {
  ok: true;
  txHash: string;
  memo: string;
  sourcePublicKey: string;
  receiverPublicKey: string;
  amountXlm: string;
  rawTransaction: unknown;
  rawOperation: unknown;
};

type HorizonTransaction = {
  id?: string;
  hash?: string;
  successful?: boolean;
  memo_type?: string;
  memo?: string;
  source_account?: string;
};

type HorizonOperation = {
  id?: string;
  type?: string;
  from?: string;
  to?: string;
  amount?: string;
  asset_type?: string;
  asset_code?: string;
};

function normalizeHorizonBaseUrl() {
  return env.STELLAR_HORIZON_URL.replace(/\/$/, "");
}

export function createPaymentMemo() {
  return `FERIA-${randomUUID().replace(/-/g, "").slice(0, 18)}`;
}

export function normalizeXlmAmount(value: string) {
  const trimmed = String(value).trim();

  if (!/^\d+(\.\d{1,7})?$/.test(trimmed)) {
    throw new Error("Monto Stellar inválido.");
  }

  return Number(trimmed).toFixed(7);
}

function assertReceiverPublicKey() {
  const receiver = env.STELLAR_RECEIVER_PUBLIC_KEY.trim();

  if (!/^G[A-Z2-7]{55}$/.test(receiver)) {
    throw new Error(
      "STELLAR_RECEIVER_PUBLIC_KEY no está configurado con una cuenta pública Stellar válida."
    );
  }

  return receiver;
}

function isNativeXlmPayment(operation: HorizonOperation) {
  return operation.type === "payment" && operation.asset_type === "native";
}

async function fetchHorizonJson<TResponse>(url: string): Promise<TResponse> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data && typeof data === "object" && "title" in data
        ? String((data as { title: unknown }).title)
        : `Horizon HTTP ${response.status}`
    );
  }

  return data as TResponse;
}

export async function verifyStellarPayment(params: {
  txHash: string;
  expectedMemo: string;
  expectedAmountXlm: string;
  expectedReceiverPublicKey?: string;
}): Promise<StellarVerifiedPayment> {
  const txHash = params.txHash.trim().toLowerCase();

  if (!/^[a-f0-9]{64}$/.test(txHash)) {
    throw new Error("Hash de transacción Stellar inválido.");
  }

  const receiverPublicKey =
    params.expectedReceiverPublicKey?.trim() || assertReceiverPublicKey();

  const expectedAmount = Number(normalizeXlmAmount(params.expectedAmountXlm));
  const horizonBaseUrl = normalizeHorizonBaseUrl();

  const transaction = await fetchHorizonJson<HorizonTransaction>(
    `${horizonBaseUrl}/transactions/${txHash}`
  );

  if (!transaction.successful) {
    throw new Error("La transacción existe, pero no fue exitosa en Stellar.");
  }

  if (transaction.memo_type !== "text") {
    throw new Error("La transacción no tiene memo de texto.");
  }

  if (String(transaction.memo ?? "") !== params.expectedMemo) {
    throw new Error("El memo de la transacción no coincide con la intención de pago.");
  }

  const operationsResponse = await fetchHorizonJson<{
    _embedded?: {
      records?: HorizonOperation[];
    };
  }>(`${horizonBaseUrl}/transactions/${txHash}/operations?limit=200`);

  const operations = operationsResponse._embedded?.records ?? [];

  const paymentOperation = operations.find((operation) => {
    const amount = Number(operation.amount ?? "0");

    return (
      isNativeXlmPayment(operation) &&
      operation.to === receiverPublicKey &&
      Number.isFinite(amount) &&
      amount >= expectedAmount
    );
  });

  if (!paymentOperation) {
    throw new Error(
      "No se encontró una operación de pago XLM válida con destino y monto esperados."
    );
  }

  return {
    ok: true,
    txHash,
    memo: String(transaction.memo),
    sourcePublicKey: String(paymentOperation.from ?? transaction.source_account ?? ""),
    receiverPublicKey,
    amountXlm: String(paymentOperation.amount ?? params.expectedAmountXlm),
    rawTransaction: transaction,
    rawOperation: paymentOperation,
  };
}
