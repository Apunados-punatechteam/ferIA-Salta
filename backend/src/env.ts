import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4100),
  FRONTEND_ORIGIN: z.string().default("http://localhost:5173"),

  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(20),
});

export const env = EnvSchema.parse(process.env);
