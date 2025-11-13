import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useState } from 'preact/hooks';

// Export the extension
export default async () => {
  render(<TellerExtension />, document.body);
};

function TellerExtension() {
  const [clicked, setClicked] = useState(false);
  const url = 'http://localhost:8001/';

  function handleClick() {
    try {
      // Пытаемся использовать глобальный API Shopify
      if (window.shopify?.navigation?.navigate) {
        window.shopify.navigation.navigate(url, { newWindow: true });
      } else if (globalThis.shopify?.navigation?.navigate) {
        globalThis.shopify.navigation.navigate(url, { newWindow: true });
      } else {
        console.log('Shopify navigation API недоступна');
        setClicked(true);
      }
    } catch (err) {
      console.error('Ошибка при перенаправлении:', err);
      setClicked(true);
    }
  }

  if (clicked) {
    return (
      <s-box padding="base">
        <s-heading level="2">Перейти к оплате</s-heading>
        <s-text>Пожалуйста, откройте ссылку:</s-text>
        <s-link href={url} target="_blank">
          {url}
        </s-link>
      </s-box>
    );
  }

  return (
    <s-button inlineSize="fill" onClick={handleClick}>
      Оплатить через Teller
    </s-button>
  );
}
