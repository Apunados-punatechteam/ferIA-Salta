import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../auth.js";
import {
  createFairEvent,
  createFairEventDecision,
  deleteFairEvent,
  getFairEvent,
  isFairApproved,
  updateFairEvent,
} from "../entityStore.js";

function normalizeCreatorRole(role: string) {
  return role === "GOVERNMENT" ? "GOVERNMENT" : "FAIR_ORGANIZER";
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
      preHandler: [requireRole(["FAIR_ORGANIZER", "GOVERNMENT"])],
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

      const created = await createFairEvent({
        ...parsed.data,
        createdByRole: normalizeCreatorRole(jwtUser.role),
        createdByName: jwtUser.username,
        createdByDocument: jwtUser.sub,
      });

      return {
        ok: true,
        fair: created,
      };
    }
  );

  app.post(
    "/fairs/decision",
    {
      preHandler: [requireRole(["GOVERNMENT"])],
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

      return {
        ok: true,
        decision: created,
      };
    }
  );

  app.put(
    "/fairs/:id",
    {
      preHandler: [requireRole(["FAIR_ORGANIZER", "GOVERNMENT"])],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = CreateFairSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          ok: false,
          error: "Datos de feria inválidos",
          details: parsed.error.flatten(),
        });
      }

      const jwtUser = request.user as { sub: string; role: string };
      const existing = await getFairEvent(id);

      if (!existing) {
        return reply.code(404).send({ ok: false, error: "Feria no encontrada" });
      }

      if (
        jwtUser.role !== "GOVERNMENT" &&
        existing.payload.createdByDocument !== jwtUser.sub
      ) {
        return reply
          .code(403)
          .send({ ok: false, error: "Solo podés editar tus propias ferias" });
      }

      const updated = await updateFairEvent(id, parsed.data);

      return { ok: true, fair: updated };
    }
  );

  app.delete(
    "/fairs/:id",
    {
      preHandler: [requireRole(["FAIR_ORGANIZER", "GOVERNMENT"])],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const jwtUser = request.user as { sub: string; role: string };
      const existing = await getFairEvent(id);

      if (!existing) {
        return reply.code(404).send({ ok: false, error: "Feria no encontrada" });
      }

      if (
        jwtUser.role !== "GOVERNMENT" &&
        existing.payload.createdByDocument !== jwtUser.sub
      ) {
        return reply
          .code(403)
          .send({ ok: false, error: "Solo podés borrar tus propias ferias" });
      }

      if (jwtUser.role !== "GOVERNMENT" && (await isFairApproved(id))) {
        return reply.code(409).send({
          ok: false,
          error: "Una feria aprobada por el gobierno no se puede borrar",
        });
      }

      const result = await deleteFairEvent(id);

      return { ok: true, ...result };
    }
  );
}
