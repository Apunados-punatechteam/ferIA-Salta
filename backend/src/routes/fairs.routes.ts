import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../auth.js";
import { createFairEvent, createFairEventDecision } from "../arkivService.js";
import { invalidateProjectEntitiesCache } from "../arkivCache.js";
import { env } from "../env.js";

function normalizeOptionalXlmAmount(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;

  const normalized = String(value).trim().replace(",", ".");

  if (!/^\d+(\.\d{1,7})?$/.test(normalized)) {
    throw new Error("Monto XLM inválido. Usá hasta 7 decimales.");
  }

  return Number(normalized).toFixed(7);
}

function normalizeOptionalStellarPublicKey(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;

  const normalized = String(value).trim();

  if (!/^G[A-Z2-7]{55}$/.test(normalized)) {
    throw new Error("Wallet Stellar inválida. Debe ser una public key que empieza con G.");
  }

  return normalized;
}

function normalizeCreatorRole(role: string) {
  return role === "MUNICIPALITY" ? "MUNICIPALITY" : "FAIR_ORGANIZER";
}

const CreateFairSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(2),
  address: z.string().min(2),
  city: z.string().min(2),
  category: z.string().min(2),
  startDate: z.string().min(8),
  endDate: z.string().min(8),
  availableSlots: z.coerce.number().int().positive(),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),

  registrationFeeXlm: z.string().optional(),
  paymentReceiverPublicKey: z.string().optional(),
  municipalityPublicationFeeXlm: z.string().optional(),
  municipalityReceiverPublicKey: z.string().optional(),
});

const DecideFairSchema = z.object({
  fairKey: z.string().min(10),
  fairName: z.string().min(2),
  fairAddress: z.string().min(2),
  fairCategory: z.string().min(2),
  fairCity: z.string().min(2),
  decision: z.enum(["approved", "rejected"]),
  notes: z.string().default(""),
});

export async function fairsRoutes(app: FastifyInstance) {
  app.post(
    "/fairs",
    {
      preHandler: [requireRole(["FAIR_ORGANIZER", "MUNICIPALITY"])],
    },
    async (request, reply) => {
      const parsed = CreateFairSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          ok: false,
          error: "Datos de feria inválidos",
          details: parsed.error.flatten(),
        });
      }

      const jwtUser = request.user as {
        sub: string;
        username: string;
        role: string;
      };

      let registrationFeeXlm: string | undefined;
      let paymentReceiverPublicKey: string | undefined;
      let municipalityPublicationFeeXlm: string | undefined;
      let municipalityReceiverPublicKey: string | undefined;

      try {
        registrationFeeXlm =
          normalizeOptionalXlmAmount(parsed.data.registrationFeeXlm) ??
          env.STELLAR_DEFAULT_ENTREPRENEUR_REGISTRATION_AMOUNT_XLM;

        paymentReceiverPublicKey = normalizeOptionalStellarPublicKey(
          parsed.data.paymentReceiverPublicKey
        );

        municipalityPublicationFeeXlm =
          normalizeOptionalXlmAmount(parsed.data.municipalityPublicationFeeXlm) ??
          env.STELLAR_DEFAULT_FAIR_PUBLICATION_AMOUNT_XLM;

        municipalityReceiverPublicKey =
          normalizeOptionalStellarPublicKey(parsed.data.municipalityReceiverPublicKey) ??
          env.STELLAR_MUNICIPALITY_RECEIVER_PUBLIC_KEY ??
          env.STELLAR_RECEIVER_PUBLIC_KEY;
      } catch (error) {
        return reply.code(400).send({
          ok: false,
          error: error instanceof Error ? error.message : "Datos de pago inválidos.",
        });
      }

      const createdByRole = normalizeCreatorRole(jwtUser.role);

      const created = await createFairEvent({
        ...parsed.data,
        createdByRole,
        createdByName: jwtUser.username,
        createdByDocument: jwtUser.sub,
        registrationFeeXlm,
        paymentReceiverPublicKey,
        municipalityPublicationFeeXlm,
        municipalityReceiverPublicKey,
      });

      invalidateProjectEntitiesCache();

      return {
        ok: true,
        fair: created,
      };
    }
  );

  app.post(
    "/fairs/decision",
    {
      preHandler: [requireRole(["MUNICIPALITY"])],
    },
    async (request, reply) => {
      const parsed = DecideFairSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          ok: false,
          error: "Datos de decisión inválidos",
          details: parsed.error.flatten(),
        });
      }

      const jwtUser = request.user as {
        sub: string;
        username: string;
        role: string;
      };

      const created = await createFairEventDecision({
        ...parsed.data,
        decidedByName: jwtUser.username,
        decidedByDocument: jwtUser.sub,
      });

      invalidateProjectEntitiesCache();

      return {
        ok: true,
        decision: created,
      };
    }
  );
}
