import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { verifyPassword } from "../auth.js";

const prisma = new PrismaClient();

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        error: "Datos inválidos",
      });
    }

    const user = await prisma.feriaUser.findUnique({
      where: {
        username: parsed.data.username,
      },
    });

    if (!user || !user.isActive) {
      return reply.code(401).send({
        ok: false,
        error: "Usuario o contraseña incorrectos",
      });
    }

    const validPassword = await verifyPassword(
      parsed.data.password,
      user.passwordHash
    );

    if (!validPassword) {
      return reply.code(401).send({
        ok: false,
        error: "Usuario o contraseña incorrectos",
      });
    }

    const token = app.jwt.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
    });

    return {
      ok: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        document: user.document,
        role: user.role,
      },
    };
  });

  app.get(
    "/auth/me",
    {
      preHandler: [app.authenticate],
    },
    async (request) => {
      return {
        ok: true,
        user: request.user,
      };
    }
  );
}
