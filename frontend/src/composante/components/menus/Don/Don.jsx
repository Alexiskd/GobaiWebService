// Importe les hooks useCallback, useEffect, useRef et useState de React.
import { useCallback, useEffect, useRef, useState } from 'react';
// Importe (début)
import {
  // les composants MUI de l'alerte, du bouton, de la pastille, de l'attente, de la fenêtre, du champ de saisie,
  Alert, Button, Chip, CircularProgress, Dialog, DialogContent, InputAdornment, Stack, TextField,
  // du bouton à bascule et du texte,
  ToggleButton, ToggleButtonGroup, Typography,
// depuis @mui/material.
} from '@mui/material';
// Importe les quatre appels de l'API des dons : annulation, confirmation, création et configuration.
import { cancelDonation, captureDonation, createDonationOrder, fetchDonationConfig } from '@/moteur/api';
// Importe useViewport, le hook qui donne le format de l'écran.
import { useViewport } from '@/composante/hooks/useViewport';
// Importe PanelHeader, l'en-tête commun des panneaux.
import { PanelHeader } from '../../ui/PanelHeader';
// Importe rememberDonation et takeDonationReturn, la mémoire du don en cours et la lecture du retour de paiement.
import { rememberDonation, takeDonationReturn } from './donationReturn';

// Montants rapides proposés, en euros.
const PRESETS = [5, 10, 20, 50, 100];
// Montant maximal : 100 000 €.
const MAX_AMOUNT = 100000; // même borne que l'API

// money : met un montant en forme, en français, dans sa devise,
const money = (n, currency = 'EUR') =>
  // avec deux décimales seulement si le montant n'est pas entier.
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);

/**
 * Fenêtre de don : montants rapides ou libres, paiement par carte bancaire sur la page sécurisée de Stripe, puis
 * retour ici (remerciement, ou annulation sans prélèvement). Ni objectif, ni limite, ni total collecté.
 */
// Déclare et exporte le composant Don, avec l'état d'ouverture et la fonction de fermeture (début).
export function Don({ open, onClose }) {
  // Format de l'écran : compact ou non.
  const { compact } = useViewport();
  // État : la configuration des dons.
  const [config, setConfig] = useState(null);
  // État : l'erreur de chargement.
  const [loadError, setLoadError] = useState('');
  // État : le montant saisi, « 10 » au départ.
  const [amountText, setAmountText] = useState('10');
  // État : le message d'erreur.
  const [error, setError] = useState('');
  // État : le montant du don confirmé, pour le remerciement.
  const [thanks, setThanks] = useState(null);
  // État : le message d'information.
  const [notice, setNotice] = useState('');
  // État : paiement en cours d'ouverture.
  const [busy, setBusy] = useState(false);
  // Référence : le composant est-il encore monté.
  const alive = useRef(true);
  // Au montage, la note à vrai ; au démontage, à faux.
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  // reload : charge la configuration des dons (début) ;
  const reload = useCallback((signal) => fetchDonationConfig(signal).then(setConfig, (e) => {
    // une erreur autre qu'une annulation est gardée.
    if (e.name !== 'AbortError') setLoadError(e.message);
  // Fin de reload.
  }), []);

  // Effet : à l'ouverture de la fenêtre (début).
  useEffect(() => {
    // Fenêtre fermée : rien.
    if (!open) return undefined;
    // Contrôleur d'annulation.
    const ctrl = new AbortController();
    // Remet tous les messages à zéro.
    setLoadError(''); setError(''); setThanks(null); setNotice(''); setBusy(false);
    // Retour de la page de paiement : on confirme le don auprès du serveur, ou on ferme la page abandonnée.
    const back = takeDonationReturn();
    // Si le don a été payé (début).
    if (back?.kind === 'paid') {
      // Le confirme auprès du serveur ;
      captureDonation(back.id)
        // puis affiche le remerciement, ou l'erreur, si le composant est encore monté.
        .then((r) => { if (alive.current) setThanks(r.amount); }, (e) => { if (alive.current) setError(e.message); });
    // Sinon, si le don a été abandonné (début).
    } else if (back?.kind === 'cancelled') {
      // Affiche que rien n'a été prélevé.
      setNotice('Don annulé : rien n’a été prélevé.');
      // Ferme la page de paiement abandonnée ; un échec est ignoré.
      if (back.id) cancelDonation(back.id).catch(() => {});
    // Fin du choix.
    }
    // Charge la configuration.
    reload(ctrl.signal);
    // Au nettoyage : annule le chargement.
    return () => ctrl.abort();
  // Fin de l'effet, relancé quand l'ouverture change.
  }, [open, reload]);

  // Montant saisi, en nombre ; la virgule vaut un point.
  const amount = Number(amountText.replace(',', '.'));

  // validate : le message d'erreur du montant, ou une chaîne vide (début).
  const validate = useCallback(() => {
    // Configuration pas encore reçue.
    if (!config) return 'Chargement…';
    // Montant illisible ou sous le minimum.
    if (!Number.isFinite(amount) || amount < config.minAmount) return `Montant minimum : ${money(config.minAmount)}.`;
    // Plus de deux décimales.
    if (Math.round(amount * 100) / 100 !== amount) return 'Deux décimales au maximum.';
    // Au-dessus du maximum.
    if (amount > MAX_AMOUNT) return `Montant maximum : ${money(MAX_AMOUNT)}.`;
    // Montant valable.
    return '';
  // Fin de validate.
  }, [amount, config]);

  // donate, asynchrone : lance le paiement (début).
  const donate = useCallback(async () => {
    // Contrôle le montant.
    const problem = validate();
    // Montant refusé : affiche le message et s'arrête.
    if (problem) { setError(problem); return; }
    // Efface les messages et note le paiement en cours.
    setError(''); setNotice(''); setBusy(true);
    // Essai (début).
    try {
      // Crée la commande : son identifiant et l'adresse de paiement.
      const { id, url } = await createDonationOrder(amount);
      // Garde l'identifiant.
      rememberDonation(id);
      // Ouvre la page de paiement.
      window.location.assign(url); // page de paiement hébergée par Stripe ; retour ici ensuite
    // En cas d'erreur (début).
    } catch (e) {
      // Affiche le message et libère le bouton, si le composant est encore monté.
      if (alive.current) { setError(e.message); setBusy(false); }
    // Fin de l'essai.
    }
  // Fin de donate.
  }, [amount, validate]);

  // Montant rapide sélectionné, si le montant saisi en est un.
  const preset = PRESETS.includes(amount) ? amount : null;

  // Rendu (début).
  return (
    // Fenêtre : plein écran sur petit écran, étroite sinon.
    <Dialog open={open} onClose={onClose} fullScreen={compact} maxWidth="xs" fullWidth aria-label="Dons au développeur de l’application Gobai">
      {/* En-tête du panneau (début). */}
      <PanelHeader
        // Sur-titre.
        kicker="Soutenir le projet"
        // Titre.
        title="Dons au développeur de l’application Gobai"
        // Pastille « Mode test », dans l'environnement de test.
        titleAdornment={config?.environment === 'test' && <Chip size="small" color="warning" label="Mode test" />}
        // Bouton de fermeture.
        onClose={onClose}
      // Fin de l'en-tête.
      />
      {/* Contenu de la fenêtre (début). */}
      <DialogContent>
        {/* Roue d'attente, tant que la configuration n'est pas arrivée. */}
        {!config && !loadError && <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress /></Stack>}
        {/* Erreur de chargement. */}
        {loadError && <Alert severity="error">Impossible de charger les dons : {loadError}</Alert>}

        {/* Une fois la configuration reçue (début). */}
        {config && (
          // Pile verticale (début).
          <Stack spacing={2.5}>
            {/* Texte de présentation (début). */}
            <Typography variant="body2" color="text.secondary">
              {/* Le texte : à quoi servent les dons. */}
              Gobai est gratuit et sans publicité. Les dons vont au développeur de l’application et financent l’hébergement et l’imagerie satellite.
            {/* Fin du texte de présentation. */}
            </Typography>

            {/* Remerciement, après un don confirmé. */}
            {thanks !== null && <Alert severity="success">Merci pour ton don de {money(thanks)} !</Alert>}
            {/* Message d'information, refermable. */}
            {notice && <Alert severity="info" onClose={() => setNotice('')}>{notice}</Alert>}
            {/* Erreur, quand les dons sont fermés. */}
            {!config.enabled && error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

            {/* Message « dons pas encore ouverts ». */}
            {!config.enabled && <Alert severity="info">Les dons ne sont pas encore ouverts.</Alert>}

            {/* Si les dons sont ouverts (début). */}
            {config.enabled && (
              // Fragment (début).
              <>
                {/* Pile des montants (début). */}
                <Stack spacing={1.5}>
                  {/* Groupe des montants rapides (début). */}
                  <ToggleButtonGroup
                    // Un seul choix à la fois.
                    exclusive
                    // Sur toute la largeur.
                    fullWidth
                    // Petite taille.
                    size="small"
                    // Montant sélectionné.
                    value={preset}
                    // Au choix : recopie le montant dans le champ et efface l'erreur.
                    onChange={(_e, v) => { if (v !== null) { setAmountText(String(v)); setError(''); } }}
                    // Nom pour les lecteurs d'écran.
                    aria-label="Montant du don"
                  // Fin des réglages du groupe.
                  >
                    {/* Pour chaque montant rapide (début) : */}
                    {PRESETS.map((v) => (
                      // son bouton.
                      <ToggleButton key={v} value={v}>{money(v)}</ToggleButton>
                    // Fin de la boucle.
                    ))}
                  {/* Fin du groupe. */}
                  </ToggleButtonGroup>
                  {/* Champ du montant libre (début). */}
                  <TextField
                    // Son libellé.
                    label="Autre montant"
                    // Petite taille.
                    size="small"
                    // Le montant saisi.
                    value={amountText}
                    // À la saisie : garde le texte et efface l'erreur.
                    onChange={(e) => { setAmountText(e.target.value); setError(''); }}
                    // En erreur si le montant saisi est refusé.
                    error={Boolean(amountText) && Boolean(validate())}
                    // Rappel du minimum.
                    helperText={`Minimum ${money(config.minAmount)}`}
                    // Réglages internes (début) :
                    slotProps={{
                      // clavier décimal et nom pour les lecteurs d'écran ;
                      htmlInput: { inputMode: 'decimal', 'aria-label': 'Montant libre en euros' },
                      // symbole € à droite.
                      input: { endAdornment: <InputAdornment position="end">€</InputAdornment> },
                    // Fin des réglages internes.
                    }}
                  // Fin du champ.
                  />
                {/* Fin de la pile des montants. */}
                </Stack>

                {/* Erreur, refermable. */}
                {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

                {/* Bouton de don (début). */}
                <Button
                  // Plein.
                  variant="contained"
                  // Grande taille.
                  size="large"
                  // Sur toute la largeur.
                  fullWidth
                  // Coupé pendant l'ouverture du paiement ou si le montant est refusé.
                  disabled={busy || Boolean(validate())}
                  // Au clic : lance le paiement.
                  onClick={donate}
                  // Roue d'attente pendant l'ouverture.
                  startIcon={busy ? <CircularProgress size={18} color="inherit" /> : null}
                // Fin des réglages du bouton.
                >
                  {/* Son texte : l'attente, ou « Donner … par carte bancaire » avec le montant s'il est valable. */}
                  {busy ? 'Ouverture du paiement…' : `Donner ${validate() ? '' : `${money(amount)} `}par carte bancaire`}
                {/* Fin du bouton. */}
                </Button>

                {/* Mention sur le paiement (début). */}
                <Typography variant="caption" color="text.secondary">
                  {/* Le texte : paiement chez Stripe, coordonnées bancaires jamais vues par Gobai. */}
                  Paiement par carte bancaire sur la page sécurisée de Stripe, puis retour ici. Gobai ne voit jamais tes coordonnées bancaires.
                {/* Fin de la mention. */}
                </Typography>
              {/* Fin du fragment. */}
              </>
            // Fin du cas « dons ouverts ».
            )}
          {/* Fin de la pile verticale. */}
          </Stack>
        // Fin du cas « configuration reçue ».
        )}
      {/* Fin du contenu. */}
      </DialogContent>
    {/* Fin de la fenêtre. */}
    </Dialog>
  // Fin du rendu.
  );
// Fin du composant Don.
}
