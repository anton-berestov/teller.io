import crypto from "node:crypto";

import { getZelleRecipientByShop } from "../models/zelleRecipient.server";

export type ZellePaymentRequest = {
  shop: string;
  amount: number;
  currency?: string;
  customerName?: string;
  customerEmail?: string;
  note?: string;
};

type TellerResponseBody = {
  id: string;
  status: string;
  [key: string]: unknown;
};

class TellerConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TellerConfigurationError";
  }
}

class TellerRequestError extends Error {
  response?: TellerResponseBody | string;
  status?: number;

  constructor(message: string, status?: number, response?: TellerResponseBody | string) {
    super(message);
    this.name = "TellerRequestError";
    this.status = status;
    this.response = response;
  }
}

const DEFAULT_TELLER_BASE_URL = "https://api.teller.io";

export async function initiateZellePayment({
  shop,
  amount,
  currency = "USD",
  customerName,
  customerEmail,
  note,
}: ZellePaymentRequest) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be a positive number");
  }

  const recipient = await getZelleRecipientByShop(shop);

  if (!recipient) {
    throw new TellerConfigurationError(
      `Missing Zelle recipient configuration for shop ${shop}`,
    );
  }

  const apiKey = process.env.TELLER_API_KEY;
  const apiSecret = process.env.TELLER_API_SECRET;
  const accountId = process.env.TELLER_ACCOUNT_ID;
  const tellerOrigin = process.env.TELLER_API_BASE_URL ?? DEFAULT_TELLER_BASE_URL;

  if (!apiKey || !apiSecret) {
    throw new TellerConfigurationError(
      "Missing Teller API credentials. Ensure TELLER_API_KEY and TELLER_API_SECRET are set.",
    );
  }

  if (!accountId) {
    throw new TellerConfigurationError(
      "Missing Teller account configuration. Set TELLER_ACCOUNT_ID with the funding account identifier.",
    );
  }

  const targetUrl = new URL(
    `/accounts/${accountId}/payments`,
    tellerOrigin.endsWith("/") ? tellerOrigin : `${tellerOrigin}/`,
  );

  const authToken = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const idempotencyKey = crypto.randomUUID();

  const body = {
    method: "zelle",
    amount: {
      currency,
      value: amount.toFixed(2),
    },
    recipient: {
      name: recipient.recipientName,
      email: recipient.recipientEmail,
    },
    customer: {
      name: customerName,
      email: customerEmail,
    },
    note,
  };

  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${authToken}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: TellerResponseBody | string = text;

  try {
    parsed = text ? (JSON.parse(text) as TellerResponseBody) : ({} as TellerResponseBody);
  } catch (error) {
    // Keep raw body if it cannot be parsed
  }

  if (!response.ok) {
    throw new TellerRequestError(
      `Teller API returned status ${response.status}`,
      response.status,
      parsed,
    );
  }

  return parsed;
}

export { TellerConfigurationError, TellerRequestError };
