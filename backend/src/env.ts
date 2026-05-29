import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4100),
  FRONTEND_ORIGIN: z.string().default("http://localhost:5173"),

  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(20),

  ARKIV_PRIVATE_KEY: z.string().startsWith("0x"),
  ARKIV_PROJECT_ATTRIBUTE_KEY: z.string().default("project"),
  ARKIV_PROJECT_ATTRIBUTE_VALUE: z.string().min(1),

  STELLAR_NETWORK: z.enum(["TESTNET", "PUBLIC"]).default("TESTNET"),
  STELLAR_HORIZON_URL: z
    .string()
    .url()
    .default("https://horizon-testnet.stellar.org"),
  STELLAR_RECEIVER_PUBLIC_KEY: z.string().min(10),
  STELLAR_FAIR_REGISTRATION_AMOUNT_XLM: z.string().default("10"),
});

export const env = EnvSchema.parse(process.env);
