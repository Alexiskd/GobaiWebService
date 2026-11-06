import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { captureDonation, createDonationOrder } from '@/api';

/**
 * Boutons PayPal officiels. Le montant est lu au clic (`amountRef`) : changer de montant ne recharge pas les boutons.
 * La commande est créée puis encaissée par notre backend, qui applique le plafond mensuel.
 */
export function PaypalButtons({ paypal, amountRef, validate, onApproved, onError }) {
  const host = useRef(null);
  const handlers = useRef({ validate, onApproved, onError });
  handlers.current = { validate, onApproved, onError };

  useEffect(() => {
    if (!paypal || !host.current) return undefined;
    let reported = false; // erreur déjà affichée par nous : on ignore le message générique de PayPal qui suit
    const report = (message) => { reported = true; handlers.current.onError(message); };

    const buttons = paypal.Buttons({
      style: { layout: 'vertical', shape: 'rect', label: 'donate', height: 44 },
      onClick: (_data, actions) => {
        reported = false;
        const problem = handlers.current.validate();
        if (problem) { report(problem); return actions.reject(); }
        handlers.current.onError('');
        return actions.resolve();
      },
      createOrder: async () => {
        try {
          const { id } = await createDonationOrder(amountRef.current);
          return id;
        } catch (e) {
          report(e.message);
          throw e;
        }
      },
      onApprove: async (data, actions) => {
        try {
          handlers.current.onApproved(await captureDonation(data.orderID));
        } catch (e) {
          if (e.status === 422 && /refusé/i.test(e.message)) return actions.restart(); // carte refusée : autre moyen
          report(e.message);
        }
        return undefined;
      },
      onError: () => { if (!reported) report('PayPal a rencontré un problème. Réessaie dans un instant.'); },
    });
    if (buttons.isEligible()) buttons.render(host.current).catch(() => {});
    return () => { buttons.close?.().catch?.(() => {}); };
  }, [paypal, amountRef]);

  return <Box ref={host} sx={{ minHeight: 100, colorScheme: 'light' }} />;
}
