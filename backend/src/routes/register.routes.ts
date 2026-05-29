import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

type PublicRegisterRole = "entrepreneur" | "fair_organizer";

type RegisterBody = {
  username?: string;
  password?: string;
  fullName?: string;
  document?: string;
  role?: PublicRegisterRole;
};

type DbUser = {
  id: string;
  username: string;
  full_name: string;
  document: string;
  role: string;
  is_active: boolean;
  created_at: Date;
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeUsername(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function normalizeRole(role: unknown): PublicRegisterRole | null {
  const normalized = normalizeText(role).toLowerCase();

  if (normalized === "entrepreneur") return "entrepreneur";
  if (normalized === "fair_organizer") return "fair_organizer";

  return null;
}

function dbRoleFromPublicRole(role: PublicRegisterRole): string {
  if (role === "fair_organizer") return "FAIR_ORGANIZER";
  return "ENTREPRENEUR";
}

function validateRegisterBody(body: RegisterBody) {
  const username = normalizeUsername(body.username);
  const password = String(body.password ?? "");
  const fullName = normalizeText(body.fullName);
  const document = normalizeText(body.document);
  const role = normalizeRole(body.role);

  if (!username) {
    return { ok: false as const, message: "El usuario es obligatorio." };
  }

  if (!/^[a-zA-Z0-9._-]{4,40}$/.test(username)) {
    return {
      ok: false as const,
      message:
        "El usuario debe tener entre 4 y 40 caracteres. Usa letras, numeros, punto, guion o guion bajo.",
    };
  }

  if (!password || password.length < 8) {
    return {
      ok: false as const,
      message: "La contrasena debe tener al menos 8 caracteres.",
    };
  }

  if (!fullName || fullName.length < 3) {
    return {
      ok: false as const,
      message: "El nombre completo es obligatorio.",
    };
  }

  if (!document || document.length < 6) {
    return {
      ok: false as const,
      message: "El DNI / CUIT / identificador es obligatorio.",
    };
  }

  if (!role) {
    return {
      ok: false as const,
      message: "El rol debe ser emprendedor o feriante.",
    };
  }

  return {
    ok: true as const,
    data: {
      username,
      password,
      fullName,
      document,
      role,
      dbRole: dbRoleFromPublicRole(role),
    },
  };
}

export async function registerRoutes(app: FastifyInstance) {
  app.post<{ Body: RegisterBody }>("/api/auth/register", async (request, reply) => {
    const parsed = validateRegisterBody(request.body ?? {});

    if (!parsed.ok) {
      return reply.code(400).send({
        ok: false,
        message: parsed.message,
      });
    }

    const { username, password, fullName, document, role, dbRole } = parsed.data;

    const client = await pool.connect();

    try {
      const duplicated = await client.query(
        `
        SELECT id, username, document
        FROM feria_users
        WHERE lower(username) = lower($1)
           OR document = $2
        LIMIT 1
        `,
        [username, document]
      );

      if (duplicated.rowCount && duplicated.rowCount > 0) {
        const existing = duplicated.rows[0] as {
          username: string;
          document: string;
        };

        const duplicatedField =
          String(existing.username).toLowerCase() === username
            ? "usuario"
            : "documento";

        return reply.code(409).send({
          ok: false,
          message:
            duplicatedField === "usuario"
              ? "Ya existe un usuario con ese nombre."
              : "Ya existe una cuenta registrada con ese documento.",
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const id = randomUUID();

      const result = await client.query<DbUser>(
        `
        INSERT INTO feria_users (
          id,
          username,
          password_hash,
          full_name,
          document,
          role,
          is_active,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
        RETURNING id, username, full_name, document, role, is_active, created_at
        `,
        [id, username, passwordHash, fullName, document, dbRole]
      );

      const createdUser = result.rows[0];

      const token = app.jwt.sign({
        sub: createdUser.id,
        username: createdUser.username,
        fullName: createdUser.full_name,
        document: createdUser.document,
        role: dbRole as "ENTREPRENEUR" | "FAIR_ORGANIZER",
      });

      return reply.code(201).send({
        ok: true,
        token,
        user: {
          id: createdUser.id,
          username: createdUser.username,
          fullName: createdUser.full_name,
          document: createdUser.document,
          role,
          isActive: createdUser.is_active,
          createdAt: createdUser.created_at,
        },
      });
    } catch (error) {
      request.log.error({ error }, "register user failed");

      return reply.code(500).send({
        ok: false,
        message: "No se pudo registrar el usuario.",
      });
    } finally {
      client.release();
    }
  });
}