// Importe de React le crochet useState.
import { useState } from 'react';
// Importe de MUI Box, Button, Link (lien externe), Stack, TextField et Typography.
import { Box, Button, Link, Stack, TextField, Typography } from '@mui/material';
// Importe le client Mistral : lecture et écriture de la clé, du modèle, et appel de test à l'API.
import { askMistral, DEFAULT_MODEL, getApiKey, getModel, isConnected, setApiKey, setModel } from '@/Car/shared/lib/mistralAssistant';
// Importe Group, le groupe de réglages.
import { Group } from '../../ui/Group.jsx';
// Importe MenuDeroulant, le menu déroulant générique.
import { MenuDeroulant } from '../../ui/MenuDeroulant.jsx';
// Importe StatusLine, la ligne d'état à pastille.
import { StatusLine } from '../../ui/StatusLine.jsx';

// Modèles proposés : les noms d'API réels de Mistral, le défaut en premier.
const MODELS = [
  { value: 'mistral-large-latest', label: 'Mistral Large (recommandé)' },
  { value: 'mistral-medium-latest', label: 'Mistral Medium' },
  { value: 'mistral-small-latest', label: 'Mistral Small' },
];

// Boutons larges : cible tactile d'au moins 44 px, marge comprise, même hauteur sur ordinateur.
const BUTTON_SX = { minHeight: 44, flex: 1, textTransform: 'none', lineHeight: 1.2 };

/**
 * Tableau de bord de la clé d'API Mistral : état de la connexion, enregistrement et retrait de la clé,
 * choix du modèle et test d'appel réel à l'API. La clé ne quitte jamais ce navigateur : elle vit dans le
 * localStorage (voir mistralAssistant.js) et part directement à api.mistral.ai dans l'en-tête Authorization.
 */
// Déclare et exporte le composant CleMistral.
export function CleMistral() {
  // État : une clé est-elle enregistrée dans ce navigateur ?
  const [connected, setConnected] = useState(isConnected());
  // État : la clé en cours de saisie, jamais affichée après l'enregistrement.
  const [draft, setDraft] = useState('');
  // État : la clé saisie est-elle affichée en clair ?
  const [show, setShow] = useState(false);
  // État : le modèle choisi.
  const [model, setModelState] = useState(getModel());
  // État : le test d'appel est en cours.
  const [busy, setBusy] = useState(false);
  // État : le résultat du test, { tone, text }.
  const [check, setCheck] = useState(null);

  // Enregistre la clé saisie, puis rafraîchit l'état.
  const save = () => {
    // Clé vide : rien à enregistrer.
    if (!draft.trim()) return;
    // Écrit la clé dans le navigateur.
    setApiKey(draft);
    // Efface le champ : la clé n'est plus affichée.
    setDraft('');
    // Rafraîchit l'état de connexion.
    setConnected(true);
    // Un ancien résultat de test ne concerne plus la clé actuelle.
    setCheck(null);
  // Fin de save.
  };

  // Retire la clé enregistrée : l'assistant repasse en démonstration.
  const remove = () => {
    // Efface la clé du navigateur.
    setApiKey('');
    // Rafraîchit l'état de connexion.
    setConnected(false);
    // Le résultat du test ne concerne plus rien.
    setCheck(null);
  // Fin de remove.
  };

  // Teste la clé par un appel réel minimal à l'API Mistral.
  const verify = async () => {
    // Un seul test à la fois.
    if (busy) return;
    // Signale l'attente.
    setBusy(true);
    setCheck({ tone: 'busy', text: 'Vérification de la clé auprès de l’API Mistral…' });
    // Début du bloc protégé.
    try {
      // Message minimal : la réponse attendue est un JSON { reply, actions }.
      await askMistral([{ role: 'user', content: 'Réponds uniquement : OK' }], []);
      // L'API a accepté la clé et le modèle.
      setCheck({ tone: 'ok', text: 'Clé acceptée : l’assistant est branché.' });
    // En cas d'échec.
    } catch (e) {
      // Le détail renvoyé par l'API (clé refusée, modèle inconnu…) est affiché tel quel.
      setCheck({ tone: 'bad', text: e.message || 'L’appel à l’API Mistral a échoué.' });
    // Dans tous les cas.
    } finally {
      // Test terminé.
      setBusy(false);
    // Fin du bloc.
    }
  // Fin de verify.
  };

  // Début du rendu.
  return (
    // Groupe titré.
    <Group title="Mistral">
      {/* La ligne d'état : branché ou démonstration (début). */}
      <Box sx={{ py: 0.5 }}>
        <StatusLine
          // Son texte.
          text={connected ? 'Clé d’API enregistrée dans ce navigateur' : 'Aucune clé enregistrée : l’assistant reste en démonstration'}
          // Son ton : vert si branché, rouge sinon.
          tone={connected ? 'ok' : 'bad'}
        />
      {/* Fin de la ligne d'état. */}
      </Box>

      {/* Le champ de saisie de la clé, masqué par défaut (début). */}
      <Box sx={{ px: 1.5, py: 1 }}>
        <TextField
          // Le type : masqué, ou en clair à la demande.
          type={show ? 'text' : 'password'}
          // Petite taille.
          size="small"
          // Toute la largeur.
          fullWidth
          // Son libellé.
          label="Clé d’API Mistral"
          // La valeur saisie.
          value={draft}
          // À chaque frappe : met la saisie à jour.
          onChange={(e) => setDraft(e.target.value)}
          // Nom pour les lecteurs d'écran et saisie automatique désactivée.
          slotProps={{ htmlInput: { 'aria-label': 'Clé d’API Mistral', autoComplete: 'off', spellCheck: false } }}
          // Le texte d'aide : la clé existante n'est jamais réaffichée, et le lien pour en créer une.
          helperText={(
            <>
              {connected ? 'Une clé est déjà enregistrée : saisir ici la remplace.' : 'Aucune clé enregistrée.'}
              {' '}Créez-en une sur{' '}
              <Link href="https://console.mistral.ai" target="_blank" rel="noopener noreferrer">console.mistral.ai</Link>.
            </>
          )}
          // Début du style.
          sx={{
            // Le texte d'aide suit la largeur du champ, mots longs coupés.
            '& .MuiFormHelperText-root': { overflowWrap: 'anywhere' },
          // Fin du style.
          }}
        />
        {/* Le bouton d'affichage en clair, sous le champ. */}
        <Button size="small" onClick={() => setShow(!show)} sx={{ mt: 0.5, textTransform: 'none', minWidth: 0, px: 1 }}>
          {show ? 'Masquer la saisie' : 'Afficher la saisie'}
        </Button>
      {/* Fin du champ. */}
      </Box>

      {/* Les boutons : enregistrer, retirer, tester (début). */}
      <Stack direction="row" spacing={1} sx={{ px: 1.5, pb: 1.5 }}>
        {/* Enregistrer : actif seulement si une clé est saisie et qu'aucun test ne tourne. */}
        <Button variant="contained" disabled={!draft.trim() || busy} onClick={save} sx={BUTTON_SX}>Enregistrer</Button>
        {/* Retirer : actif seulement si une clé existe. */}
        <Button variant="outlined" disabled={!connected || busy} onClick={remove} sx={BUTTON_SX}>Retirer</Button>
        {/* Tester : actif seulement si une clé est enregistrée. */}
        <Button variant="outlined" disabled={!connected || busy} onClick={verify} sx={BUTTON_SX}>Tester</Button>
      {/* Fin des boutons. */}
      </Stack>

      {/* Le résultat du test, s'il y en a un. */}
      {check && <StatusLine text={check.text} tone={check.tone} />}

      {/* Le choix du modèle (début). */}
      <Box sx={{ px: 1.5, pb: 1.5 }}>
        <MenuDeroulant
          // Son libellé.
          label="Modèle"
          // Ses options.
          options={MODELS}
          // La valeur choisie.
          value={model}
          // Au changement : enregistre le modèle.
          onChange={(value) => setModel(value)}
          // Toute la largeur.
          sx={{ width: '100%' }}
        />
        {/* Le rappel du modèle par défaut, si l'utilisateur en a choisi un autre. */}
        {model !== DEFAULT_MODEL && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, px: 0.5 }}>
            Choix enregistré ; le modèle par défaut reste « {DEFAULT_MODEL} ».
          </Typography>
        )}
      {/* Fin du choix du modèle. */}
      </Box>

      {/* La note de confidentialité. */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 1.5, pb: 1.5, lineHeight: 1.45 }}>
        La clé reste dans ce navigateur (localStorage) et part directement à api.mistral.ai. Elle n’est jamais envoyée aux serveurs de Gobai Space ni écrite dans le dépôt.
      </Typography>
    {/* Fin du groupe. */}
    </Group>
  // Fin du rendu.
  );
// Fin de CleMistral.
}
