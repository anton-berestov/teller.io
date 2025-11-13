import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  HeadersFunction,
} from "react-router";
import { useFetcher, useLoaderData, useRouteError } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import {
  getZelleRecipientByShop,
  upsertZelleRecipient,
} from "../models/zelleRecipient.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

type ActionErrors = Partial<Record<"recipientName" | "recipientEmail", string>>;
type ActionResult = {
  ok: boolean;
  errors?: ActionErrors;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const recipient = await getZelleRecipientByShop(session.shop);

  return { recipient };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const recipientName = (formData.get("recipientName") || "").toString().trim();
  const recipientEmail = (formData.get("recipientEmail") || "").toString().trim();

  const errors: ActionErrors = {};

  if (!recipientName) {
    errors.recipientName = "Введите имя получателя Zelle";
  }

  if (!recipientEmail) {
    errors.recipientEmail = "Укажите email, на который отправлять Zelle";
  } else if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.toLowerCase())
  ) {
    errors.recipientEmail = "Некорректный email";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  await upsertZelleRecipient({
    shop: session.shop,
    recipientName,
    recipientEmail,
  });

  return { ok: true };
};

export default function ZelleSettings() {
  const { recipient } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<ActionResult>();
  const [recipientName, setRecipientName] = useState(
    recipient?.recipientName ?? "",
  );
  const [recipientEmail, setRecipientEmail] = useState(
    recipient?.recipientEmail ?? "",
  );

  const isSaving =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  const appBridge = useAppBridge();

  useEffect(() => {
    if (recipient) {
      setRecipientName(recipient.recipientName);
      setRecipientEmail(recipient.recipientEmail);
    }
  }, [recipient]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      appBridge.toast?.show("Настройки Zelle сохранены");
    }
  }, [fetcher.state, fetcher.data?.ok, appBridge]);

  const errors = fetcher.data?.errors;

  return (
    <s-page heading="Оплата через Zelle">
      <s-section heading="Реквизиты получателя">
        <fetcher.Form method="post">
          <s-stack direction="block" gap="base">
          <s-text-field
            name="recipientName"
            label="Имя получателя"
            value={recipientName}
            onChange={(event) => setRecipientName(event.currentTarget.value)}
            error={errors?.recipientName}
            required
          />
          <s-text-field
            name="recipientEmail"
            label="Email для Zelle"
            value={recipientEmail}
            onChange={(event) => setRecipientEmail(event.currentTarget.value)}
            error={errors?.recipientEmail}
            required
          />
            <s-button type="submit" variant="primary" loading={isSaving}>
              Сохранить
            </s-button>
          </s-stack>
        </fetcher.Form>
      </s-section>
      <s-section slot="aside" heading="Как это работает">
        <s-stack direction="block" gap="base">
          <s-text>
            Клиент увидит модальное окно с инструкциями по оплате через Zelle.
            Укажите имя и email того счёта, на который должны приходить
            переводы.
          </s-text>
          <s-text>
            Добавьте на витрину скрипт <code>zelle-modal.js</code>, чтобы модалка
            показывалась при клике по кнопке покупки.
          </s-text>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
