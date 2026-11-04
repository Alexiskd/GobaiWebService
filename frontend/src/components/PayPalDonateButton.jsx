import { useEffect, useState } from 'react';
import { fetchDonationConfig } from '@/api';

const DONATE_SDK_URL = 'https://www.paypalobjects.com/donate/sdk/donate-sdk.js';
let donateSdkPromise;

function loadDonateSdk() {
  if (window.PayPal?.Donation?.Button) return Promise.resolve(window.PayPal);
  if (donateSdkPromise) return donateSdkPromise;

  donateSdkPromise = new Promise((resolve, reject) => {
    let script = document.querySelector(`script[src="${DONATE_SDK_URL}"]`);
    const onLoad = () => {
      if (window.PayPal?.Donation?.Button) resolve(window.PayPal);
      else reject(new Error('Le SDK Donate PayPal est chargé mais indisponible.'));
    };
    const onError = () => reject(new Error('Impossible de charger le SDK Donate PayPal.'));

    if (!script) {
      script = document.createElement('script');
      script.src = DONATE_SDK_URL;
      script.charset = 'UTF-8';
      script.async = true;
      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', onError, { once: true });
      document.head.appendChild(script);
    } else {
      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', onError, { once: true });
    }
  }).catch((error) => {
    donateSdkPromise = undefined;
    throw error;
  });

  return donateSdkPromise;
}

export default function PayPalDonateButton() {
  const [status, setStatus] = useState('loading');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    const containerId = 'paypal-donate-button-container';

    fetchDonationConfig(controller.signal)
      .then(async (config) => {
        if (!config.enabled) {
          if (mounted) setStatus('ready');
          return;
        }

        setEnabled(true);
        const paypal = await loadDonateSdk();
        if (!mounted) return;

        const buttonOptions = {
          env: config.environment,
          image: {
            src: 'https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif',
            title: 'PayPal - The safer, easier way to pay online!',
            alt: 'Faire un don avec PayPal',
          },
        };
        if (config.hostedButtonId) buttonOptions.hosted_button_id = config.hostedButtonId;
        if (config.business) buttonOptions.business = config.business;

        paypal.Donation.Button(buttonOptions).render(`#${containerId}`);
        setStatus('ready');
      })
      .catch((error) => {
        if (error.name === 'AbortError' || !mounted) return;
        console.error('Impossible de charger le bouton de don PayPal.', error);
        setStatus('error');
      });

    return () => {
      mounted = false;
      controller.abort();
      document.getElementById(containerId)?.replaceChildren();
    };
  }, []);

  if (status === 'loading' || (status === 'ready' && !enabled)) return null;
  if (status === 'error') {
    return <span className="donation-unavailable" role="status">Soutien indisponible</span>;
  }

  return (
    <div className="donation-button" aria-label="Faire un don avec PayPal">
      <div id="paypal-donate-button-container" />
    </div>
  );
}
