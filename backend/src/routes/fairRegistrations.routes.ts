import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { requireRole } from "../auth.js";
import {
  createFairCertificate,
  createFairRegistration,
  createFairRegistrationCancellation,
} from "../arkivService.js";
import { getProjectEntitiesCached, invalidateProjectEntitiesCache } from "../arkivCache.js";

type ArkivEntity = Record<string, unknown>;

type FairPayload = {
  name?: string;
  address?: string;
  category?: string;
  availableSlots?: number;
  status?: string;
};

type DecisionPayload = {
  fairKey?: string;
  decision?: string;
  decidedAt?: number;
};

type RegistrationPayload = {
  fairKey?: string;
  status?: string;
};

type CancellationPayload = {
  fairKey?: string;
  registrationKey?: string;
};

const CancelRegistrationSchema = z.object({
  fairKey: z.string().min(10),
  registrationKey: z.string().min(10),
  notes: z.string().default("Cancelled by municipality."),
});

const fairLocks = new Map<string, Promise<void>>();

function getEntityType(entity: ArkivEntity): string {
  const attrs = Array.isArray(entity.attributes) ? entity.attributes : [];

  for (const attr of attrs) {
    if (attr && typeof attr === "object") {
      const item = attr as Record<string, unknown>;
      if (String(item.key ?? "") === "entityType") {
        return String(item.value ?? "");
      }
    }
  }

  return "unknown";
}

function getPayload<TPayload>(entity: ArkivEntity): TPayload {
  if (entity.payload && typeof entity.payload === "object") {
    return entity.payload as TPayload;
  }

  return {} as TPayload;
}

function getEntityKey(entity: ArkivEntity): string {
  return String(entity.entityKey ?? entity.key ?? entity.id ?? "");
}

function getLatestDecisionByFairKey(entities: ArkivEntity[]) {
  const decisions = entities
    .filter((entity) => getEntityType(entity) === "fair_event_decision")
    .map((entity) => {
      const payload = getPayload<DecisionPayload>(entity);

      return {
        fairKey: String(payload.fairKey ?? ""),
        decision: String(payload.decision ?? ""),
        decidedAt: Number(payload.decidedAt ?? entity.createdAt ?? 0),
      };
    })
    .filter((item) => item.fairKey && item.decision)
    .sort((a, b) => b.decidedAt - a.decidedAt);

  const map = new Map<string, (typeof decisions)[number]>();

  for (const decision of decisions) {
    if (!map.has(decision.fairKey)) {
      map.set(decision.fairKey, decision);
    }
  }

  return map;
}

function getCancellationSet(entities: ArkivEntity[]) {
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

function getActiveRegistrationsForFair(entities: ArkivEntity[], fairKey: string) {
  const cancelled = getCancellationSet(entities);

  return entities.filter((entity) => {
    if (getEntityType(entity) !== "fair_registration") return false;

    const key = getEntityKey(entity);
    const payload = getPayload<RegistrationPayload>(entity);

    return (
      String(payload.fairKey ?? "") === fairKey &&
      String(payload.status ?? "active") === "active" &&
      !cancelled.has(key)
    );
  });
}

function findApprovedFair(entities: ArkivEntity[], fairKey: string) {
  const fair = entities.find(
    (entity) =>
      getEntityType(entity) === "fair_event" && getEntityKey(entity) === fairKey
  );

  if (!fair) return null;

  const latestDecision = getLatestDecisionByFairKey(entities).get(fairKey);

  if (latestDecision?.decision !== "approved") {
    return null;
  }

  return fair;
}

function getRemainingSlots(entities: ArkivEntity[], fairKey: string, fair: ArkivEntity) {
  const payload = getPayload<FairPayload>(fair);
  const totalSlots = Number(payload.availableSlots ?? 0);
  const activeCount = getActiveRegistrationsForFair(entities, fairKey).length;

  return Math.max(totalSlots - activeCount, 0);
}

async function withFairLock<TValue>(fairKey: string, work: () => Promise<TValue>) {
  const previous = fairLocks.get(fairKey) ?? Promise.resolve();

  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });

  fairLocks.set(fairKey, previous.then(() => current));

  await previous;

  try {
    return await work();
  } finally {
    release();

    if (fairLocks.get(fairKey) === current) {
      fairLocks.delete(fairKey);
    }
  }
}

function extensionFromMime(mimeType: string): string {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  return ".jpg";
}

async function saveUploadFile(params: {
  file: {
    filename: string;
    mimetype: string;
    toBuffer: () => Promise<Buffer>;
  };
  folder: string;
  prefix: string;
}) {
  if (!params.file.mimetype.startsWith("image/")) {
    throw new Error("Only image files are allowed.");
  }

  const buffer = await params.file.toBuffer();
  const maxSize = 5 * 1024 * 1024;

  if (buffer.length > maxSize) {
    throw new Error("Image is too large. Max size is 5MB.");
  }

  const ext = extensionFromMime(params.file.mimetype);
  const fileName = `${params.prefix}_${randomUUID()}${ext}`;
  const uploadRoot = path.join(process.cwd(), "uploads");
  const uploadFolder = path.join(uploadRoot, params.folder);

  await mkdir(uploadFolder, { recursive: true });

  const absolutePath = path.join(uploadFolder, fileName);
  await writeFile(absolutePath, buffer);

  return `/uploads/${params.folder}/${fileName}`;
}

export async function fairRegistrationsRoutes(app: FastifyInstance) {
  app.post(
    "/fair-registrations",
    {
      preHandler: [requireRole(["ENTREPRENEUR"])],
    },
    async (request, reply) => {
      const jwtUser = request.user as {
        sub: string;
        username: string;
        role: string;
        document?: string;
        fullName?: string;
      };

      const fields: Record<string, string> = {};
      let standPhotoUrl = "";
      const articlePhotoUrls: string[] = [];

      for await (const part of request.parts()) {
        if (part.type === "file") {
          if (part.fieldname === "standPhoto") {
            standPhotoUrl = await saveUploadFile({
              file: part,
              folder: "registrations",
              prefix: "stand",
            });
          }

          if (part.fieldname === "articlePhotos") {
            if (articlePhotoUrls.length >= 3) {
              continue;
            }

            const url = await saveUploadFile({
              file: part,
              folder: "registrations",
              prefix: "article",
            });

            articlePhotoUrls.push(url);
          }
        } else {
          fields[part.fieldname] = String(part.value ?? "");
        }
      }

      const fairKey = String(fields.fairKey ?? "").trim();

      if (!fairKey) {
        return reply.code(400).send({
          ok: false,
          error: "fairKey is required.",
        });
      }

      if (!standPhotoUrl) {
        return reply.code(400).send({
          ok: false,
          error: "Stand photo is required.",
        });
      }

      return withFairLock(fairKey, async () => {
        const cachedEntities = await getProjectEntitiesCached();
        const entities = cachedEntities.entities as ArkivEntity[];

        if (!Array.isArray(entities) || entities.length === 0) {
          return reply.code(503).send({
            ok: false,
            error: "No se pudieron cargar las ferias aprobadas en este momento. Intentá nuevamente en unos segundos.",
          });
        }

        const fair = findApprovedFair(entities, fairKey);

        if (!fair) {
          return reply.code(409).send({
            ok: false,
            error: "Fair is not approved or does not exist.",
          });
        }

        const remainingSlots = getRemainingSlots(entities, fairKey, fair);

        if (remainingSlots <= 0) {
          return reply.code(409).send({
            ok: false,
            error: "No slots available for this fair.",
          });
        }

        const fairPayload = getPayload<FairPayload>(fair);
        const entrepreneurName = jwtUser.fullName ?? jwtUser.username;
        const entrepreneurDocument = jwtUser.document ?? jwtUser.sub;

        const registration = await createFairRegistration({
          fairKey,
          fairName: String(fairPayload.name ?? "Feria"),
          fairAddress: String(fairPayload.address ?? "Sin direccion"),
          fairCategory: String(fairPayload.category ?? "sin_rubro"),
          entrepreneurName,
          entrepreneurDocument,
          businessName: String(fields.businessName ?? entrepreneurName),
          phone: String(fields.phone ?? ""),
          description: String(fields.description ?? ""),
          standPhotoUrl,
          articlePhotoUrls,
        });

        const certificate = await createFairCertificate({
      fairKey,
      registrationKey: registration.entityKey,
      fairName: String(fairPayload.name ?? "Feria"),
      entrepreneurName,
      entrepreneurDocument,
      businessName: String(fields.businessName ?? entrepreneurName),
    });

    invalidateProjectEntitiesCache();

    return {
      ok: true,
      registration,
      certificate,
      remainingSlots: remainingSlots - 1,
    };
      });
    }
  );

  app.post(
    "/fair-registrations/cancel",
    {
      preHandler: [requireRole(["MUNICIPALITY"])],
    },
    async (request, reply) => {
      const parsed = CancelRegistrationSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          ok: false,
          error: "Invalid cancellation data.",
          details: parsed.error.flatten(),
        });
      }

      const jwtUser = request.user as {
        sub: string;
        username: string;
        role: string;
        document?: string;
        fullName?: string;
      };

      const cancellation = await createFairRegistrationCancellation({
      fairKey: parsed.data.fairKey,
      registrationKey: parsed.data.registrationKey,
      notes: parsed.data.notes,
      cancelledByName: jwtUser.fullName ?? jwtUser.username,
      cancelledByDocument: jwtUser.document ?? jwtUser.sub,
    });

    invalidateProjectEntitiesCache();

    return {
      ok: true,
      cancellation,
    };
    }
  );
}



