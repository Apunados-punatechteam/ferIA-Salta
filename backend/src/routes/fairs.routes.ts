import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../auth.js";
import { createFairEvent, createFairEventDecision } from "../arkivService.js";
import { invalidateProjectEntitiesCache } from "../arkivCache.js";

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
      preHandler: [requireRole(["FAIR_ORGANIZER"])],
    },
    async (request, reply) => {
      const parsed = CreateFairSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          ok: false,
          error: "Datos de feria invÃ¡lidos",
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
      createdByName: jwtUser.username,
      createdByDocument: jwtUser.sub,
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
          error: "Datos de decisiÃ³n invÃ¡lidos",
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


