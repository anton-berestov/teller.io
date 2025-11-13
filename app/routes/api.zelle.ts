import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "react-router";

import { getZelleRecipientByShop } from "../models/zelleRecipient.server";
import {
  initiateZellePayment,
  TellerConfigurationError,
  TellerRequestError,
} from "../services/teller.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return Response.json({ error: "Missing shop parameter" }, { status: 400 });
  }

  const recipient = await getZelleRecipientByShop(shop);

  if (!recipient) {
    return Response.json(
      {
        error: "Zelle recipient not configured for this shop",
      },
      { status: 404 },
    );
  }

  return Response.json({
    recipient: {
      name: recipient.recipientName,
      email: recipient.recipientEmail,
    },
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload || typeof payload !== "object") {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    shop,
    amount,
    currency,
    customerName,
    customerEmail,
    note,
  } = payload as Record<string, unknown>;

  if (!shop || typeof shop !== "string") {
    return Response.json({ error: "Missing shop identifier" }, { status: 400 });
  }

  const numericAmount =
    typeof amount === "number"
      ? amount
      : typeof amount === "string"
        ? Number.parseFloat(amount)
        : Number.NaN;

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return Response.json(
      { error: "Amount must be a positive number" },
      { status: 400 },
    );
  }

  try {
    const response = await initiateZellePayment({
      shop,
      amount: numericAmount,
      currency:
        typeof currency === "string" && currency.length > 0
          ? currency
          : "USD",
      customerName:
        typeof customerName === "string" ? customerName : undefined,
      customerEmail:
        typeof customerEmail === "string" ? customerEmail : undefined,
      note: typeof note === "string" ? note : undefined,
    });

    return Response.json(
      {
        ok: true,
        payment: response,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof TellerConfigurationError) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    if (error instanceof TellerRequestError) {
      return Response.json(
        {
          error: error.message,
          tellerStatus: error.status,
          tellerResponse: error.response,
        },
        { status: error.status ?? 502 },
      );
    }

    return Response.json(
      { error: "Unexpected error initiating Zelle payment" },
      { status: 500 },
    );
  }
};
