import { getProjectEntitiesCached } from "./arkivCache.js";
import { env } from "./env.js";
import { normalizeXlmAmount } from "./stellarPaymentService.js";

type ArkivAttribute = {
  key?: string;
  value?: unknown;
};

type ArkivEntity = {
  entityKey?: string;
  payload?: unknown;
  attributes?: ArkivAttribute[];
};

type PaymentPricing = {
  amountXlm: string;
  receiverPublicKey: string;
  paymentConcept: "ENTREPRENEUR_REGISTRATION_FEE" | "FAIR_PUBLICATION_FEE";
  payerRole: "ENTREPRENEUR" | "FAIR_ORGANIZER";
  payeeRole: "MUNICIPALITY" | "FAIR_ORGANIZER";
  payeeDocument: string;
  payeeName: string;
};

function getPayloadObject(entity: ArkivEntity | null): Record<string, unknown> {
  if (entity?.payload && typeof entity.payload === "object") {
    return entity.payload as Record<string, unknown>;
  }

  return {};
}

function getAttr(entity: ArkivEntity | null, key: string): unknown {
  return entity?.attributes?.find((item) => item.key === key)?.value;
}

function getText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }

  return "";
}

function getPublicKey(...values: unknown[]): string {
  const value = getText(...values);

  if (/^G[A-Z2-7]{55}$/.test(value)) {
    return value;
  }

  return "";
}

function getEntityType(entity: ArkivEntity | null): string {
  const payload = getPayloadObject(entity);

  return getText(
    getAttr(entity, "entityType"),
    payload.entityType,
    payload.type,
    payload.kind
  ).toLowerCase();
}

function getAmount(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return normalizeXlmAmount(String(value));
    }

    if (typeof value === "string" && value.trim()) {
      try {
        return normalizeXlmAmount(value);
      } catch {
        // Sigue buscando otro valor válido.
      }
    }
  }

  return "";
}

function asArkivEntities(value: unknown): ArkivEntity[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is ArkivEntity => {
    return Boolean(item && typeof item === "object");
  });
}

async function findFairByKey(fairKey?: string) {
  if (!fairKey) return null;

  const cached = await getProjectEntitiesCached();
  const entities = asArkivEntities(cached.entities);

  return (
    entities.find((entity) => {
      const payload = getPayloadObject(entity);
      const entityType = getEntityType(entity);

      const currentKey = getText(
        entity.entityKey,
        payload.fairKey,
        payload.id
      );

      return (
        currentKey === fairKey &&
        (entityType === "fair_event" ||
          entityType === "fair" ||
          Boolean(payload.fairName || payload.name || payload.title))
      );
    }) ?? null
  );
}

export async function resolveEntrepreneurRegistrationPricing(params: {
  fairKey?: string;
}): Promise<PaymentPricing> {
  const fair = await findFairByKey(params.fairKey);
  const payload = getPayloadObject(fair);

  const createdByRole = getText(
    payload.createdByRole,
    payload.creatorRole,
    payload.ownerRole,
    getAttr(fair, "createdByRole")
  ).toUpperCase();

  const fairOrganizerReceiver = getPublicKey(
    payload.paymentReceiverPublicKey,
    payload.organizerReceiverPublicKey,
    payload.fairOrganizerReceiverPublicKey,
    payload.stellarReceiverPublicKey,
    getAttr(fair, "paymentReceiverPublicKey")
  );

  const municipalityReceiver =
    getPublicKey(
      payload.municipalityReceiverPublicKey,
      getAttr(fair, "municipalityReceiverPublicKey")
    ) ||
    env.STELLAR_MUNICIPALITY_RECEIVER_PUBLIC_KEY ||
    env.STELLAR_RECEIVER_PUBLIC_KEY;

  const amountXlm =
    getAmount(
      payload.registrationFeeXlm,
      payload.entrepreneurRegistrationFeeXlm,
      payload.priceXlm,
      payload.amountXlm,
      getAttr(fair, "registrationFeeXlm")
    ) ||
    normalizeXlmAmount(
      env.STELLAR_DEFAULT_ENTREPRENEUR_REGISTRATION_AMOUNT_XLM ||
        env.STELLAR_FAIR_REGISTRATION_AMOUNT_XLM
    );

  const fairWasCreatedByMunicipality =
    createdByRole === "MUNICIPALITY" ||
    createdByRole === "MUNICIPALIDAD";

  if (fairWasCreatedByMunicipality || !fairOrganizerReceiver) {
    return {
      amountXlm,
      receiverPublicKey: municipalityReceiver,
      paymentConcept: "ENTREPRENEUR_REGISTRATION_FEE",
      payerRole: "ENTREPRENEUR",
      payeeRole: "MUNICIPALITY",
      payeeDocument: getText(
        payload.createdByDocument,
        payload.municipalityDocument
      ),
      payeeName: getText(payload.createdByName, "Municipalidad"),
    };
  }

  return {
    amountXlm,
    receiverPublicKey: fairOrganizerReceiver,
    paymentConcept: "ENTREPRENEUR_REGISTRATION_FEE",
    payerRole: "ENTREPRENEUR",
    payeeRole: "FAIR_ORGANIZER",
    payeeDocument: getText(payload.createdByDocument, payload.organizerDocument),
    payeeName: getText(payload.createdByName, payload.organizerName, "Feriante"),
  };
}

export function resolveFairPublicationPricing(): PaymentPricing {
  const amountXlm = normalizeXlmAmount(
    env.STELLAR_DEFAULT_FAIR_PUBLICATION_AMOUNT_XLM
  );

  return {
    amountXlm,
    receiverPublicKey:
      env.STELLAR_MUNICIPALITY_RECEIVER_PUBLIC_KEY ||
      env.STELLAR_RECEIVER_PUBLIC_KEY,
    paymentConcept: "FAIR_PUBLICATION_FEE",
    payerRole: "FAIR_ORGANIZER",
    payeeRole: "MUNICIPALITY",
    payeeDocument: "",
    payeeName: "Municipalidad",
  };
}
