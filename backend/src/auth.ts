import bcrypt from "bcryptjs";
import type { FastifyReply, FastifyRequest } from "fastify";

export type JwtUser = {
  sub: string;
  username: string;
  role: "ENTREPRENEUR" | "FAIR_ORGANIZER" | "MUNICIPALITY";
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({
      ok: false,
      error: "No autenticado",
    });
  }
}

export function requireRole(allowedRoles: Array<JwtUser["role"]>) {
  return async function roleGuard(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      await request.jwtVerify();

      const user = request.user as JwtUser;

      if (!allowedRoles.includes(user.role)) {
        reply.code(403).send({
          ok: false,
          error: "No tenés permiso para realizar esta acción",
        });
      }
    } catch {
      reply.code(401).send({
        ok: false,
        error: "No autenticado",
      });
    }
  };
}
