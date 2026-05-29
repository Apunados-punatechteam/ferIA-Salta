import { createPublicClient, http } from "@arkiv-network/sdk";
import { braga } from "@arkiv-network/sdk/chains";

export const ARKIV_BRAGA_RPC_URL = "https://braga.hoodi.arkiv.network/rpc";

export const PROJECT_ATTRIBUTE = {
  key: "project",
  value: "feria-arkiv-punatech26-salta-7x9k",
} as const;

export const ENTITY_TYPES = {
  PROFILE: "entrepreneur_profile",
  APPLICATION: "fair_application",
  CERTIFICATE: "fair_certificate",
  ASSISTANT_MESSAGE: "assistant_message",
  PAYMENT_RECORD: "payment_record",
  USER_PROFILE: "user_profile",
  FAIR_EVENT: "fair_event",
  FAIR_REGISTRATION: "fair_registration",
  MUNICIPALITY_DECISION: "municipality_decision",
} as const;

export const EXPIRATION_SECONDS = {
  ASSISTANT_MESSAGE: 60 * 60 * 24 * 7,
  PROFILE: 60 * 60 * 24 * 180,
  APPLICATION: 60 * 60 * 24 * 90,
  CERTIFICATE: 60 * 60 * 24 * 365,
  PAYMENT_RECORD: 60 * 60 * 24 * 120,
  USER_PROFILE: 60 * 60 * 24 * 180,
  FAIR_EVENT: 60 * 60 * 24 * 120,
  FAIR_REGISTRATION: 60 * 60 * 24 * 90,
  MUNICIPALITY_DECISION: 60 * 60 * 24 * 365,
} as const;

export const arkivPublicClient = createPublicClient({
  chain: braga,
  transport: http(),
});

export function getArkivPrivateKey(): `0x${string}` {
  const privateKey = import.meta.env.VITE_ARKIV_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error(
      "Falta VITE_ARKIV_PRIVATE_KEY en .env.local. Configurá una private key de testnet y reiniciá Vite."
    );
  }

  if (!privateKey.startsWith("0x")) {
    throw new Error("VITE_ARKIV_PRIVATE_KEY debe comenzar con 0x.");
  }

  return privateKey as `0x${string}`;
}
