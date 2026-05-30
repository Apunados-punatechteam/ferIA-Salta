import { PrismaClient, type StellarPayment } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../auth.js";
import { invalidateProjectEntitiesCache } from "../arkivCache.js";
import { env } from "../env.js";
import { resolveEntrepreneurRegistrationPricing } from "../stellarPricingService.js";
import {
  createPaymentMemo,
  normalizeXlmAmount,
  verifyStellarPayment,
} from "../stellarPaymentService.js";

const prisma = new PrismaClient();

const CreatePaymentIntentSchema = z.object({
  registrationKey: z.string().optional(),
  fairKey: z.string().optional(),
});

const VerifyPaymentSchema = z.object({
  paymentIntentId: z.string().uuid(),
  txHash: z.string().min(20),
});

const PaymentsQuerySchema = z.object({
  registrationKey: z.string().optional(),
  fairKey: z.string().optional(),
  status: z.enum(["PENDING", "CONFIRMED", "REJECTED", "EXPIRED"]).optional(),
});

function getJwtUser(requestUser: unknown) {
  const user =
    requestUser && typeof requestUser === "object"
      ? (requestUser as Record<string, unknown>)
      : {};

  return {
    sub: String(user.sub ?? ""),
    username: String(user.username ?? ""),
    role: String(user.role ?? ""),
    document: String(user.document ?? user.sub ?? ""),
  };
}

function getReceiverPublicKey() {
  const receiverPublicKey = env.STELLAR_RECEIVER_PUBLIC_KEY.trim();

  if (!/^G[A-Z2-7]{55}$/.test(receiverPublicKey)) {
    throw new Error(
      "STELLAR_RECEIVER_PUBLIC_KEY no está configurado correctamente en backend/.env."
    );
  }

  return receiverPublicKey;
}

function serializePayment(payment: StellarPayment) {
  return {
    id: payment.id,
    registrationKey: payment.registrationKey,
    fairKey: payment.fairKey,
    userUsername: payment.userUsername,
    userDocument: payment.userDocument,
    amountXlm: payment.amountXlm.toString(),
    assetCode: payment.assetCode,
    paymentConcept: payment.paymentConcept,
    payerRole: payment.payerRole,
    payeeRole: payment.payeeRole,
    payeeDocument: payment.payeeDocument,
    payeeName: payment.payeeName,
    network: payment.network,
    receiverPublicKey: payment.receiverPublicKey,
    sourcePublicKey: payment.sourcePublicKey,
    memo: payment.memo,
    txHash: payment.txHash,
    status: payment.status,
    createdAt: payment.createdAt,
    confirmedAt: payment.confirmedAt,
  };
}

async function findExistingPaymentForRegistration(params: {
  registrationKey?: string;
  userId: string;
}) {
  if (!params.registrationKey) return null;

  const confirmed = await prisma.stellarPayment.findFirst({
    where: {
      registrationKey: params.registrationKey,
      userId: params.userId,
      status: "CONFIRMED",
    },
    orderBy: {
      confirmedAt: "desc",
    },
  });

  if (confirmed) return confirmed;

  const pending = await prisma.stellarPayment.findFirst({
    where: {
      registrationKey: params.registrationKey,
      userId: params.userId,
      status: "PENDING",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return pending;
}

export async function stellarPaymentsRoutes(app: FastifyInstance) {
  app.post(
    "/stellar/payments/intents",
    {
      preHandler: [requireRole(["ENTREPRENEUR"])],
    },
    async (request, reply) => {
      const parsed = CreatePaymentIntentSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          ok: false,
          error: "Datos de pago inválidos.",
          details: parsed.error.flatten(),
        });
      }

      const user = getJwtUser(request.user);

      const existingPayment = await findExistingPaymentForRegistration({
        registrationKey: parsed.data.registrationKey,
        userId: user.sub,
      });

      if (existingPayment?.status === "CONFIRMED") {
        return {
          ok: true,
          reused: true,
          alreadyConfirmed: true,
          payment: serializePayment(existingPayment),
          message: "Esta inscripción ya tiene un pago Stellar confirmado.",
        };
      }

      if (existingPayment?.status === "PENDING") {
        return {
          ok: true,
          reused: true,
          alreadyConfirmed: false,
          payment: serializePayment(existingPayment),
          message: "Ya existe una intención de pago pendiente para esta inscripción.",
        };
      }

      const pricing = await resolveEntrepreneurRegistrationPricing({
        fairKey: parsed.data.fairKey,
      });

      const memo = createPaymentMemo();

      const payment = await prisma.stellarPayment.create({
        data: {
          registrationKey: parsed.data.registrationKey || null,
          fairKey: parsed.data.fairKey || null,
          userId: user.sub,
          userUsername: user.username,
          userDocument: user.document,
          amountXlm: pricing.amountXlm,
          assetCode: "XLM",
          paymentConcept: pricing.paymentConcept,
          payerRole: pricing.payerRole,
          payeeRole: pricing.payeeRole,
          payeeDocument: pricing.payeeDocument,
          payeeName: pricing.payeeName,
          network: env.STELLAR_NETWORK,
          receiverPublicKey: pricing.receiverPublicKey,
          memo,
          status: "PENDING",
        },
      });

      return {
        ok: true,
        reused: false,
        alreadyConfirmed: false,
        payment: serializePayment(payment),
        message: "Intención de pago creada.",
      };
    }
  );

  app.post(
    "/stellar/payments/verify",
    {
      preHandler: [requireRole(["ENTREPRENEUR", "MUNICIPALITY"])],
    },
    async (request, reply) => {
      const parsed = VerifyPaymentSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          ok: false,
          error: "Datos de verificación inválidos.",
          details: parsed.error.flatten(),
        });
      }

      const user = getJwtUser(request.user);

      const payment = await prisma.stellarPayment.findUnique({
        where: {
          id: parsed.data.paymentIntentId,
        },
      });

      if (!payment) {
        return reply.code(404).send({
          ok: false,
          error: "Intención de pago no encontrada.",
        });
      }

      if (user.role !== "MUNICIPALITY" && payment.userId !== user.sub) {
        return reply.code(403).send({
          ok: false,
          error: "No tenés permiso para verificar este pago.",
        });
      }

      if (payment.status === "CONFIRMED") {
        return {
          ok: true,
          payment: serializePayment(payment),
          message: "El pago ya estaba confirmado.",
        };
      }

      const duplicatedTxHash = await prisma.stellarPayment.findFirst({
        where: {
          txHash: parsed.data.txHash.trim().toLowerCase(),
          NOT: {
            id: payment.id,
          },
        },
      });

      if (duplicatedTxHash) {
        return reply.code(409).send({
          ok: false,
          error: "Esta transacción Stellar ya fue usada para otro pago.",
        });
      }

      const verified = await verifyStellarPayment({
        txHash: parsed.data.txHash,
        expectedMemo: payment.memo,
        expectedAmountXlm: payment.amountXlm.toString(),
        expectedReceiverPublicKey: payment.receiverPublicKey,
      });

      const updated = await prisma.stellarPayment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: "CONFIRMED",
          txHash: verified.txHash,
          sourcePublicKey: verified.sourcePublicKey,
          rawTransaction: verified.rawTransaction as object,
          rawOperation: verified.rawOperation as object,
          confirmedAt: new Date(),
        },
      });

      invalidateProjectEntitiesCache();

      return {
        ok: true,
        payment: serializePayment(updated),
        message: "Pago confirmado correctamente en Stellar.",
      };
    }
  );

  app.post(
    "/stellar/payments/cleanup-duplicates",
    {
      preHandler: [requireRole(["MUNICIPALITY"])],
    },
    async () => {
      const confirmedPayments = await prisma.stellarPayment.findMany({
        where: {
          status: "CONFIRMED",
          registrationKey: {
            not: null,
          },
        },
        select: {
          id: true,
          registrationKey: true,
        },
      });

      let updatedCount = 0;

      for (const confirmed of confirmedPayments) {
        if (!confirmed.registrationKey) continue;

        const result = await prisma.stellarPayment.updateMany({
          where: {
            registrationKey: confirmed.registrationKey,
            status: "PENDING",
            NOT: {
              id: confirmed.id,
            },
          },
          data: {
            status: "EXPIRED",
          },
        });

        updatedCount += result.count;
      }

      return {
        ok: true,
        expiredPendingPayments: updatedCount,
      };
    }
  );
  app.get(
    "/stellar/payments",
    {
      preHandler: [requireRole(["ENTREPRENEUR", "MUNICIPALITY"])],
    },
    async (request, reply) => {
      const user = getJwtUser(request.user);
      const parsed = PaymentsQuerySchema.safeParse(request.query);

      if (!parsed.success) {
        return reply.code(400).send({
          ok: false,
          error: "Filtros de pagos inválidos.",
          details: parsed.error.flatten(),
        });
      }

      const payments = await prisma.stellarPayment.findMany({
        where: {
          ...(user.role === "MUNICIPALITY"
            ? {}
            : {
                userId: user.sub,
              }),
          ...(parsed.data.registrationKey
            ? {
                registrationKey: parsed.data.registrationKey,
              }
            : {}),
          ...(parsed.data.fairKey
            ? {
                fairKey: parsed.data.fairKey,
              }
            : {}),
          ...(parsed.data.status
            ? {
                status: parsed.data.status,
              }
            : {}),
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 200,
      });

      return {
        ok: true,
        payments: payments.map(serializePayment),
      };
    }
  );

  app.get(
    "/stellar/payments/registration/:registrationKey",
    {
      preHandler: [requireRole(["ENTREPRENEUR", "MUNICIPALITY"])],
    },
    async (request, reply) => {
      const user = getJwtUser(request.user);
      const params = request.params as {
        registrationKey?: string;
      };

      const registrationKey = String(params.registrationKey ?? "").trim();

      if (!registrationKey) {
        return reply.code(400).send({
          ok: false,
          error: "registrationKey es requerido.",
        });
      }

      const payments = await prisma.stellarPayment.findMany({
        where: {
          registrationKey,
          ...(user.role === "MUNICIPALITY"
            ? {}
            : {
                userId: user.sub,
              }),
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const confirmed = payments.find((payment) => payment.status === "CONFIRMED");
      const pending = payments.find((payment) => payment.status === "PENDING");

      return {
        ok: true,
        registrationKey,
        paymentStatus: confirmed ? "CONFIRMED" : pending ? "PENDING" : "UNPAID",
        confirmedPayment: confirmed ? serializePayment(confirmed) : null,
        pendingPayment: pending ? serializePayment(pending) : null,
        payments: payments.map(serializePayment),
      };
    }
  );
}




