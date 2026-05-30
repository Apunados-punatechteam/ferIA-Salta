import type {
  EntrepreneurProfile,
  FairApplication,
  FairCertificate,
  LocalArkivEntity,
} from "../types/feria";

import { ENTITY_TYPES, EXPIRATION_SECONDS, PROJECT_ATTRIBUTE } from "../lib/arkiv";

const STORAGE_KEY = "feria_local_arkiv_entities";

function randomEntityKey(prefix: string): string {
  const timestamp = Date.now();
  const random = crypto.randomUUID().slice(0, 8);
  return `${prefix}_${timestamp}_${random}`;
}

function readAllEntities(): LocalArkivEntity<unknown>[] {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as LocalArkivEntity<unknown>[];
  } catch {
    return [];
  }
}

function saveEntity<TPayload>(
  entity: LocalArkivEntity<TPayload>
): LocalArkivEntity<TPayload> {
  const current = readAllEntities();
  const next = [entity as LocalArkivEntity<unknown>, ...current];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return entity;
}

export function clearLocalArkivStore(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function listLocalArkivEntities(): LocalArkivEntity<unknown>[] {
  return readAllEntities();
}

export function appendLocalEntity<TPayload>(
  entity: LocalArkivEntity<TPayload>
): LocalArkivEntity<TPayload> {
  return saveEntity(entity);
}

export function createEntrepreneurProfileEntity(
  profile: Omit<EntrepreneurProfile, "createdAt">
): LocalArkivEntity<EntrepreneurProfile> {
  const createdAt = Date.now();

  return saveEntity({
    entityKey: randomEntityKey("profile"),
    payload: {
      ...profile,
      createdAt,
    },
    contentType: "application/json",
    expiresIn: EXPIRATION_SECONDS.PROFILE,
    createdAt,
    source: "local_demo",
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

export function createFairApplicationEntity(params: {
  profileKey: string;
  fairName: string;
  fairSlug: string;
  productDescription: string;
}): LocalArkivEntity<FairApplication> {
  const createdAt = Date.now();

  return saveEntity({
    entityKey: randomEntityKey("application"),
    payload: {
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
    },
    contentType: "application/json",
    expiresIn: EXPIRATION_SECONDS.APPLICATION,
    createdAt,
    source: "local_demo",
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

export function createFairCertificateEntity(params: {
  applicationKey: string;
  holderName: string;
  businessName: string;
  fairName: string;
}): LocalArkivEntity<FairCertificate> {
  const issuedAt = Date.now();

  const certificateNumber = `FERIA-${new Date().getFullYear()}-${String(
    Math.floor(Math.random() * 999999)
  ).padStart(6, "0")}`;

  return saveEntity({
    entityKey: randomEntityKey("certificate"),
    payload: {
      applicationKey: params.applicationKey,
      certificateNumber,
      holderName: params.holderName,
      businessName: params.businessName,
      fairName: params.fairName,
      issuedAt,
      status: "issued",
    },
    contentType: "application/json",
    expiresIn: EXPIRATION_SECONDS.CERTIFICATE,
    createdAt: issuedAt,
    source: "local_demo",
    attributes: [
      PROJECT_ATTRIBUTE,
      { key: "entityType", value: ENTITY_TYPES.CERTIFICATE },
      { key: "applicationKey", value: params.applicationKey },
      { key: "certificateNumber", value: certificateNumber },
      { key: "status", value: "issued" },
      { key: "issuedAt", value: issuedAt },
    ],
  });
}
