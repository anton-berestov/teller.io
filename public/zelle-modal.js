'use strict';

(function () {
  const scriptEl = document.currentScript;
  const dataset = scriptEl ? scriptEl.dataset : {};
  const shop =
    dataset.shop ||
    window.__ZELLE_SHOP__ ||
    (window.Shopify && window.Shopify.shop) ||
    '';
  const apiBase =
    dataset.apiBase ||
    window.__ZELLE_API_BASE__ ||
    '';

  const resolveUrl = (path) => {
    if (!apiBase) {
      return path;
    }

    const normalizedBase = apiBase.endsWith('/')
      ? apiBase.slice(0, -1)
      : apiBase;
    return `${normalizedBase}${path.startsWith('/') ? path : `/${path}`}`;
  };

  if (!shop) {
    console.warn(
      '[ZelleModal] Unable to determine the shop domain. Provide data-shop attribute or set window.__ZELLE_SHOP__.',
    );
    return;
  }

  const ready = (callback) => {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(callback, 0);
      return;
    }
    document.addEventListener('DOMContentLoaded', callback);
  };

  const createOverlay = (recipient, context) => {
    const overlay = document.createElement('div');
    overlay.className = 'zelle-modal-overlay';
    overlay.innerHTML = `
      <div class="zelle-modal-card" role="dialog" aria-modal="true">
        <button type="button" class="zelle-modal-close" aria-label="Закрыть">&times;</button>
        <h2 class="zelle-modal-heading">Оплата через Zelle</h2>
        <p class="zelle-modal-text">
          Переведите оплату через Zelle на реквизиты ниже и подтвердите перевод.
        </p>
        <div class="zelle-modal-recipient">
          <div>
            <span class="zelle-modal-label">Имя получателя</span>
            <span class="zelle-modal-value">${recipient.name}</span>
          </div>
          <div>
            <span class="zelle-modal-label">Email</span>
            <span class="zelle-modal-value">${recipient.email}</span>
          </div>
          ${
            context.amount
              ? `<div>
                    <span class="zelle-modal-label">Сумма</span>
                    <span class="zelle-modal-value">${context.amount} ${context.currency || 'USD'}</span>
                 </div>`
              : ''
          }
        </div>
        <div class="zelle-modal-actions">
          <button type="button" class="zelle-modal-button zelle-confirm">Я отправил перевод</button>
          <button type="button" class="zelle-modal-button zelle-cancel">Отмена</button>
        </div>
        <div class="zelle-modal-feedback" aria-live="polite"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  };

  const ensureStyles = () => {
    if (document.getElementById('zelle-modal-styles')) {
      return;
    }

    const styles = document.createElement('style');
    styles.id = 'zelle-modal-styles';
    styles.innerHTML = `
      .zelle-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(17, 17, 17, 0.52);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2147483647;
        padding: 16px;
      }

      .zelle-modal-card {
        background: #ffffff;
        border-radius: 16px;
        max-width: 420px;
        width: 100%;
        box-shadow: 0 24px 48px rgba(15, 25, 55, 0.18);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #111213;
        position: relative;
        padding: 32px 28px 28px;
      }

      .zelle-modal-close {
        position: absolute;
        top: 12px;
        right: 14px;
        border: none;
        background: transparent;
        font-size: 24px;
        cursor: pointer;
        color: #63656a;
      }

      .zelle-modal-heading {
        margin: 0 0 8px;
        font-size: 22px;
        font-weight: 600;
      }

      .zelle-modal-text {
        margin: 0 0 20px;
        line-height: 1.5;
        color: #44474d;
      }

      .zelle-modal-recipient {
        display: grid;
        gap: 12px;
        background: #f6f6f7;
        padding: 16px;
        border-radius: 12px;
        margin-bottom: 24px;
      }

      .zelle-modal-label {
        display: block;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #6d7175;
        margin-bottom: 4px;
      }

      .zelle-modal-value {
        font-size: 16px;
        font-weight: 600;
      }

      .zelle-modal-actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 12px;
      }

      .zelle-modal-button {
        flex: 1 1 auto;
        border: none;
        border-radius: 12px;
        padding: 12px 18px;
        cursor: pointer;
        font-weight: 600;
        font-size: 15px;
      }

      .zelle-modal-button.zelle-confirm {
        background: #5c6ac4;
        color: #ffffff;
      }

      .zelle-modal-button.zelle-confirm[disabled] {
        opacity: 0.6;
        cursor: progress;
      }

      .zelle-modal-button.zelle-cancel {
        background: #ebedf0;
        color: #1f2226;
      }

      .zelle-modal-feedback {
        min-height: 20px;
        font-size: 14px;
        color: #2c6ecb;
      }

      .zelle-modal-feedback.zelle-error {
        color: #d72c0d;
      }
    `;
    document.head.appendChild(styles);
  };

  const collectContext = (button) => {
    const amountAttr =
      button.getAttribute('data-amount') ||
      button.getAttribute('data-price') ||
      '';
    const amount = amountAttr ? parseFloat(amountAttr) : NaN;

    return {
      amount: Number.isFinite(amount) ? amount.toFixed(2) : '',
      currency: button.getAttribute('data-currency') || 'USD',
      customerName: button.getAttribute('data-customer-name') || undefined,
      customerEmail: button.getAttribute('data-customer-email') || undefined,
      note: button.getAttribute('data-note') || undefined,
    };
  };

  const attachListeners = (recipient) => {
    ensureStyles();

    const buttons = document.querySelectorAll(
      '[data-zelle-purchase], .zelle-purchase-button',
    );

    if (!buttons.length) {
      console.warn(
        '[ZelleModal] Кнопка покупки не найдена. Добавьте атрибут data-zelle-purchase.',
      );
    }

    const trySendPayment = async (context, feedbackEl, confirmBtn) => {
      if (!context.amount) {
        feedbackEl.textContent =
          'Перевод выполните вручную — сумма заказа не передана в скрипт.';
        return;
      }

      confirmBtn.disabled = true;
      feedbackEl.textContent = 'Создаём перевод...';

      try {
        const response = await fetch(resolveUrl('/api/zelle'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shop,
            amount: Number.parseFloat(context.amount),
            currency: context.currency,
            customerName: context.customerName,
            customerEmail: context.customerEmail,
            note: context.note,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
          const message =
            (result && result.error) ||
            'Не удалось зафиксировать платёж в Teller.';
          feedbackEl.textContent = message;
          feedbackEl.classList.add('zelle-error');
          confirmBtn.disabled = false;
          return;
        }

        feedbackEl.textContent = 'Перевод создан. Спасибо за оплату!';
        confirmBtn.disabled = true;
      } catch (error) {
        feedbackEl.textContent =
          'Не удалось связаться с сервером. Проверьте соединение.';
        feedbackEl.classList.add('zelle-error');
        confirmBtn.disabled = false;
      }
    };

    buttons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const context = collectContext(button);
        const overlay = createOverlay(recipient, context);

        const close = () => overlay.remove();
        overlay
          .querySelector('.zelle-modal-close')
          .addEventListener('click', close);
        overlay
          .querySelector('.zelle-cancel')
          .addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
            close();
          }
        });

        const feedbackEl = overlay.querySelector('.zelle-modal-feedback');
        const confirmBtn = overlay.querySelector('.zelle-confirm');

        confirmBtn.addEventListener('click', () => {
          trySendPayment(context, feedbackEl, confirmBtn);
        });
      });
    });
  };

  const loadRecipient = async () => {
    try {
      const response = await fetch(
        `${resolveUrl('/api/zelle')}?shop=${encodeURIComponent(shop)}`,
      );

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data = await response.json();

      if (!data.recipient) {
        throw new Error('Recipient data not available');
      }

      return data.recipient;
    } catch (error) {
      console.error('[ZelleModal] Failed to load recipient configuration.', error);
      return null;
    }
  };

  ready(async () => {
    const recipient = await loadRecipient();
    if (!recipient) {
      return;
    }

    attachListeners(recipient);
  });
})();
