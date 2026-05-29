import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../auth.js";
import { env } from "../env.js";
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
      const receiverPublicKey = getReceiverPublicKey();

      const amountXlm = normalizeXlmAmount(
        env.STELLAR_FAIR_REGISTRATION_AMOUNT_XLM
      );

      const memo = createPaymentMemo();

      const payment = await prisma.stellarPayment.create({
        data: {
          registrationKey: parsed.data.registrationKey || null,
          fairKey: parsed.data.fairKey || null,
          userId: user.sub,
          userUsername: user.username,
          userDocument: user.document,
          amountXlm,
          assetCode: "XLM",
          network: env.STELLAR_NETWORK,
          receiverPublicKey,
          memo,
          status: "PENDING",
        },
      });

      return {
        ok: true,
        payment: {
          id: payment.id,
          status: payment.status,
          registrationKey: payment.registrationKey,
          fairKey: payment.fairKey,
          amountXlm: payment.amountXlm.toString(),
          assetCode: payment.assetCode,
          network: payment.network,
          receiverPublicKey: payment.receiverPublicKey,
          memo: payment.memo,
          createdAt: payment.createdAt,
          confirmedAt: payment.confirmedAt,
          txHash: payment.txHash,
        },
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
          payment: {
            id: payment.id,
            status: payment.status,
            txHash: payment.txHash,
            amountXlm: payment.amountXlm.toString(),
            memo: payment.memo,
            confirmedAt: payment.confirmedAt,
          },
        };
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

      return {
        ok: true,
        payment: {
          id: updated.id,
          status: updated.status,
          txHash: updated.txHash,
          amountXlm: updated.amountXlm.toString(),
          memo: updated.memo,
          confirmedAt: updated.confirmedAt,
        },
      };
    }
  );

  app.get(
    "/stellar/payments",
    {
      preHandler: [requireRole(["ENTREPRENEUR", "MUNICIPALITY"])],
    },
    async (request) => {
      const user = getJwtUser(request.user);

      const payments = await prisma.stellarPayment.findMany({
        where:
          user.role === "MUNICIPALITY"
            ? {}
            : {
                userId: user.sub,
              },
        orderBy: {
          createdAt: "desc",
        },
        take: 100,
      });

      return {
        ok: true,
        payments: payments.map((payment) => ({
          id: payment.id,
          registrationKey: payment.registrationKey,
          fairKey: payment.fairKey,
          userUsername: payment.userUsername,
          userDocument: payment.userDocument,
          amountXlm: payment.amountXlm.toString(),
          assetCode: payment.assetCode,
          network: payment.network,
          receiverPublicKey: payment.receiverPublicKey,
          sourcePublicKey: payment.sourcePublicKey,
          memo: payment.memo,
          txHash: payment.txHash,
          status: payment.status,
          createdAt: payment.createdAt,
          confirmedAt: payment.confirmedAt,
        })),
      };
    }
  );
}
