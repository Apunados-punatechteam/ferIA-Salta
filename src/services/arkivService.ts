import { createWalletClient, http } from "@arkiv-network/sdk";
import { privateKeyToAccount } from "@arkiv-network/sdk/accounts";
import { braga } from "@arkiv-network/sdk/chains";
import { eq } from "@arkiv-network/sdk/query";
import { jsonToPayload } from "@arkiv-network/sdk/utils";

import {
  ENTITY_TYPES,
  EXPIRATION_SECONDS,
  PROJECT_ATTRIBUTE,
  arkivPublicClient,
  getArkivPrivateKey,
} from "../lib/arkiv";

import type {
  EntrepreneurProfile,
  FairApplication,
  FairCertificate,
  FairEventPayload,
  FairMapEvent,
  FairRegistration,
  MunicipalityDecision,
  LocalArkivEntity,
} from "../types/feria";

type ArkivFetchedEntity = {
  entityKey?: string;
  key?: string;
  id?: string;
  txHash?: string;
  payload?: unknown;
  contentType?: string;
  attributes?: Array<{ key: string; value: string | number }>;
  expiresIn?: number;
  createdAt?: number;
  toJson?: () => unknown | Promise<unknown>;
};

function getWalletClient() {
  return createWalletClient({
    chain: braga,
    transport: http(),
    account: privateKeyToAccount(getArkivPrivateKey()),
  });
}

async function createJsonEntity<TPayload extends object>(params: {
  payload: TPayload;
  attributes: Array<{ key: string; value: string | number }>;
  expiresIn: number;
  createdAt: number;
}): Promise<LocalArkivEntity<TPayload>> {
  const walletClient = getWalletClient();

  const { entityKey, txHash } = await walletClient.createEntity({
    payload: jsonToPayload(params.payload),
    contentType: "application/json",
    attributes: params.attributes,
    expiresIn: params.expiresIn,
  });

  return {
    entityKey,
    txHash,
    payload: params.payload,
    contentType: "application/json",
    attributes: params.attributes,
    expiresIn: params.expiresIn,
    createdAt: params.createdAt,
    source: "arkiv_real",
  };
}

function getEntityKey(entity: ArkivFetchedEntity): string {
  return (
    entity.entityKey ??
    entity.key ??
    entity.id ??
    `arkiv_entity_${crypto.randomUUID()}`
  );
}

function getCreatedAtFromAttributes(
  attributes: Array<{ key: string; value: string | number }>
): number {
  const value = attributes.find((attribute) => attribute.key === "createdAt")?.value;

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  return Date.now();
}

async function normalizeArkivFetchedEntity(
  entity: ArkivFetchedEntity
): Promise<LocalArkivEntity<unknown>> {
  const attributes = entity.attributes ?? [];

  let payload: unknown = entity.payload ?? {};

  if (entity.toJson) {
    try {
      payload = await entity.toJson();
    } catch {
      payload = entity.payload ?? {};
    }
  }

  return {
    entityKey: getEntityKey(entity),
    txHash: entity.txHash,
    payload,
    contentType: "application/json",
    attributes,
    expiresIn: entity.expiresIn ?? 0,
    createdAt: entity.createdAt ?? getCreatedAtFromAttributes(attributes),
    source: "arkiv_real",
  };
}

function extractEntitiesFromSdkResult(result: unknown): ArkivFetchedEntity[] {
  if (Array.isArray(result)) {
    return result as ArkivFetchedEntity[];
  }

  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;

    const possibleArrays = [
      obj.entities,
      obj.items,
      obj.data,
      obj.results,
      obj.records,
      obj.rows,
    ];

    for (const value of possibleArrays) {
      if (Array.isArray(value)) {
        return value as ArkivFetchedEntity[];
      }
    }

    if (obj.result && typeof obj.result === "object") {
      const nested = obj.result as Record<string, unknown>;

      const nestedArrays = [
        nested.entities,
        nested.items,
        nested.data,
        nested.results,
        nested.records,
        nested.rows,
      ];

      for (const value of nestedArrays) {
        if (Array.isArray(value)) {
          return value as ArkivFetchedEntity[];
        }
      }
    }
  }

  return [];
}

export async function fetchArkivProjectEntities(): Promise<
  LocalArkivEntity<unknown>[]
> {
  const queryResult = await arkivPublicClient
    .buildQuery()
    .where(eq(PROJECT_ATTRIBUTE.key, PROJECT_ATTRIBUTE.value))
    .withAttributes(true)
    .withPayload(true)
    .limit(100)
    .fetch();

  const rawEntities = extractEntitiesFromSdkResult(queryResult);

  const normalizedEntities = await Promise.all(
    rawEntities.map((entity) =>
      normalizeArkivFetchedEntity(entity as ArkivFetchedEntity)
    )
  );

  return normalizedEntities
    .filter((entity) => {
      if (!entity.attributes || entity.attributes.length === 0) {
        return true;
      }

      return entity.attributes.some(
        (attribute) =>
          attribute.key === PROJECT_ATTRIBUTE.key &&
          attribute.value === PROJECT_ATTRIBUTE.value
      );
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function createArkivEntrepreneurProfileEntity(
  profile: Omit<EntrepreneurProfile, "createdAt">
): Promise<LocalArkivEntity<EntrepreneurProfile>> {
  const createdAt = Date.now();

  const payload: EntrepreneurProfile = {
    ...profile,
    createdAt,
  };

  return createJsonEntity({
    payload,
    expiresIn: EXPIRATION_SECONDS.PROFILE,
    createdAt,
    attributes: [
      PROJECT_ATTRIBUTE,
      { key: "entityType", value: ENTITY_TYPES.PROFILE },
      { key: "documentNumber", value: profile.documentNumber },
      { key: "category", value: profile.category },
      { key: "city", value: profile.city },
      { key: "createdAt", value: createdAt },
    ],
  });
}

export async function createArkivFairApplicationEntity(params: {
  profileKey: string;
  fairName: string;
  fairSlug: string;
  productDescription: string;
}): Promise<LocalArkivEntity<FairApplication>> {
  const createdAt = Date.now();

  const payload: FairApplication = {
    profileKey: params.profileKey,
    fairName: params.fairName,
    fairSlug: params.fairSlug,
    productDescription: params.productDescription,
    requirements: [
      "DNI o CUIT",
      "Nombre del emprendimiento",
      "Rubro",
      "Descripción breve de productos",
      "Teléfono de contacto",
    ],
    status: "submitted",
    createdAt,
  };

  return createJsonEntity({
    payload,
    expiresIn: EXPIRATION_SECONDS.APPLICATION,
    createdAt,
    attributes: [
      PROJECT_ATTRIBUTE,
      { key: "entityType", value: ENTITY_TYPES.APPLICATION },
      { key: "profileKey", value: params.profileKey },
      { key: "fairSlug", value: params.fairSlug },
      { key: "status", value: "submitted" },
      { key: "createdAt", value: createdAt },
    ],
  });
}

export async function createArkivFairCertificateEntity(params: {
  applicationKey: string;
  registrationKey?: string;
  decisionKey?: string;
  holderName: string;
  businessName: string;
  fairName: string;
  approvedBy?: string;
  municipalApprovalAt?: number;
}): Promise<LocalArkivEntity<FairCertificate>> {
  const issuedAt = Date.now();

  const certificateNumber = `FERIA-${new Date().getFullYear()}-${String(
    Math.floor(Math.random() * 999999)
  ).padStart(6, "0")}`;

  const payload: FairCertificate = {
    applicationKey: params.applicationKey,
    registrationKey: params.registrationKey,
    decisionKey: params.decisionKey,
    certificateNumber,
    holderName: params.holderName,
    businessName: params.businessName,
    fairName: params.fairName,
    approvedBy: params.approvedBy,
    municipalApprovalAt: params.municipalApprovalAt,
    issuedAt,
    status: "issued",
  };

  const attributes: Array<{ key: string; value: string | number }> = [
    PROJECT_ATTRIBUTE,
    { key: "entityType", value: ENTITY_TYPES.CERTIFICATE },
    { key: "applicationKey", value: params.applicationKey },
    { key: "certificateNumber", value: certificateNumber },
    { key: "status", value: "issued" },
    { key: "issuedAt", value: issuedAt },
  ];

  if (params.registrationKey) {
    attributes.push({ key: "registrationKey", value: params.registrationKey });
  }

  if (params.decisionKey) {
    attributes.push({ key: "decisionKey", value: params.decisionKey });
  }

  if (params.approvedBy) {
    attributes.push({ key: "approvedBy", value: params.approvedBy });
  }

  if (params.municipalApprovalAt) {
    attributes.push({
      key: "municipalApprovalAt",
      value: params.municipalApprovalAt,
    });
  }

  return createJsonEntity({
    payload,
    expiresIn: EXPIRATION_SECONDS.CERTIFICATE,
    createdAt: issuedAt,
    attributes,
  });
}

export async function createArkivFairEventEntity(params: {
  fair: FairMapEvent;
  publishedBy: string;
}): Promise<LocalArkivEntity<FairEventPayload>> {
  const createdAt = Date.now();

  const startTimestamp = new Date(`${params.fair.startDate}T00:00:00`).getTime();

  const payload: FairEventPayload = {
    ...params.fair,
    createdAt,
    publishedBy: params.publishedBy,
  };

  return createJsonEntity({
    payload,
    expiresIn: EXPIRATION_SECONDS.FAIR_EVENT,
    createdAt,
    attributes: [
      PROJECT_ATTRIBUTE,
      { key: "entityType", value: ENTITY_TYPES.FAIR_EVENT },
      { key: "fairSlug", value: params.fair.slug },
      { key: "status", value: params.fair.status },
      { key: "category", value: params.fair.category },
      { key: "city", value: params.fair.city },
      { key: "startTimestamp", value: startTimestamp },
      { key: "createdAt", value: createdAt },
    ],
  });
}

export async function createArkivFairRegistrationEntity(params: {
  fairKey: string;
  fairSlug: string;
  fairName: string;
  entrepreneurName: string;
  documentNumber: string;
  businessName: string;
  category: string;
  productDescription: string;
  phone: string;
  city: string;
}): Promise<LocalArkivEntity<FairRegistration>> {
  const createdAt = Date.now();

  const payload: FairRegistration = {
    fairKey: params.fairKey,
    fairSlug: params.fairSlug,
    fairName: params.fairName,
    entrepreneurName: params.entrepreneurName,
    documentNumber: params.documentNumber,
    businessName: params.businessName,
    category: params.category,
    productDescription: params.productDescription,
    phone: params.phone,
    city: params.city,
    status: "pending",
    createdAt,
  };

  return createJsonEntity({
    payload,
    expiresIn: EXPIRATION_SECONDS.FAIR_REGISTRATION,
    createdAt,
    attributes: [
      PROJECT_ATTRIBUTE,
      { key: "entityType", value: ENTITY_TYPES.FAIR_REGISTRATION },
      { key: "fairKey", value: params.fairKey },
      { key: "fairSlug", value: params.fairSlug },
      { key: "documentNumber", value: params.documentNumber },
      { key: "businessName", value: params.businessName },
      { key: "status", value: "pending" },
      { key: "createdAt", value: createdAt },
    ],
  });
}


export async function createArkivMunicipalityDecisionEntity(params: {
  registrationKey: string;
  fairKey: string;
  fairSlug: string;
  fairName: string;
  entrepreneurName: string;
  documentNumber: string;
  businessName: string;
  decision: "approved" | "rejected";
  decidedBy: string;
  notes: string;
}): Promise<LocalArkivEntity<MunicipalityDecision>> {
  const decidedAt = Date.now();

  const payload: MunicipalityDecision = {
    registrationKey: params.registrationKey,
    fairKey: params.fairKey,
    fairSlug: params.fairSlug,
    fairName: params.fairName,
    entrepreneurName: params.entrepreneurName,
    documentNumber: params.documentNumber,
    businessName: params.businessName,
    decision: params.decision,
    decidedBy: params.decidedBy,
    notes: params.notes,
    decidedAt,
  };

  return createJsonEntity({
    payload,
    expiresIn: EXPIRATION_SECONDS.MUNICIPALITY_DECISION,
    createdAt: decidedAt,
    attributes: [
      PROJECT_ATTRIBUTE,
      { key: "entityType", value: ENTITY_TYPES.MUNICIPALITY_DECISION },
      { key: "registrationKey", value: params.registrationKey },
      { key: "fairKey", value: params.fairKey },
      { key: "fairSlug", value: params.fairSlug },
      { key: "documentNumber", value: params.documentNumber },
      { key: "businessName", value: params.businessName },
      { key: "decision", value: params.decision },
      { key: "decidedAt", value: decidedAt },
      { key: "createdAt", value: decidedAt },
    ],
  });
}

