// Importe de React les crochets useEffect, useRef et useState.
import { useEffect, useRef, useState } from 'react';
// Importe de MUI Box, ButtonBase, Chip, CircularProgress, Paper, Popper (bloc ancré à un élément), Stack, TextField et Typography.
import { Box, ButtonBase, Chip, CircularProgress, Paper, Popper, Stack, TextField, Typography } from '@mui/material';
// Importe l'envoi d'une question à l'assistant et la lecture de sa configuration.
import { askAssistant, fetchAssistantConfig } from '@/moteur/api';
// Importe le relevé des éléments actionnables de la page.
import { collectInventory } from '@/moteur/lib/domInventory';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/composante/hooks/useViewport';
// Importe la hauteur de la bande des astres, celle du bandeau titre et edge.
import { RAIL, STRIP_H, TITLE_H, edge } from '@/composante/theme/layout';
// Importe safe, qui donne une marge de sécurité de l'écran.
import { safe } from '@/composante/theme/mediaQueries';
// Icônes de la coche, de la fermeture et de l'envoi.
import { CheckIcon, CloseIcon, SendIcon } from '../../ui/icons';

/** Questions proposées : un appui les envoie dans la conversation. */
// Questions proposées (début du tableau).
const SUGGESTIONS = [
  // Une question de connaissance.
  'Quelle est la plus grande lune du système solaire ?',
  // Une autre question de connaissance.
  'Pourquoi Vénus tourne-t-elle à l’envers ?',
  // Une demande de déplacement.
  'Emmène-moi sur Saturne',
  // Une demande de réglage.
  'Masque les lignes d’orbite',
  // Une demande qui ouvre une fenêtre et change un réglage de cartographie.
  'Montre-moi le LiDAR HD au-dessus de Toulouse',
// Fin du tableau.
];

/** Mêmes bornes que l'API (assistant.dto.ts) : 12 messages par envoi, 1 000 caractères par message. */
// Nombre maximal de messages envoyés à chaque question.
const MAX_HISTORY = 12;
// Hauteur de la barre d'outils de l'ordinateur, marge comprise.
const DESKTOP_BAR_H = 52; // barre d'outils du bas (ordinateur) et sa marge
// Longueur maximale d'un message, en caractères.
const MAX_CHARS = 1000;

/** Réponse fixe tant que la clé de l'API n'est pas configurée sur le serveur : rien n'est envoyé. */
// Réponse affichée tant que l'assistant n'est pas branché.
const NOT_CONNECTED = 'L’assistant n’est pas encore branché : cette fenêtre est une démonstration. Votre message n’a été envoyé nulle part.';

/**
 * Couleurs et polices du menu, les mêmes de jour comme de nuit (le reste de l'interface suit le thème de l'application) :
 * fond anthracite chaud, texte blanc cassé, lignes survolées en gris plus clair, orange du logo pour l'action principale.
 * Les réponses de Claude sont en caractères à empattements, le reste en caractères bâtons.
 */
// Couleurs du menu (début de l'objet).
const C = {
  // Le fond du panneau, celui du champ, celui d'une ligne survolée et la bordure.
  panel: '#1f1e1d', field: '#262624', row: '#30302e', border: '#3b3a37',
  // Le texte, le texte atténué, l'accent orange et l'erreur.
  text: '#eceae3', muted: '#a3a097', accent: '#d97757', error: '#e5867a',
// Fin de l'objet.
};
// Police bâton.
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
// Police à empattements.
const SERIF = 'Georgia, "Iowan Old Style", "Times New Roman", serif';

/** Un message : celui de l'utilisateur dans une pastille grise à droite, la réponse de Claude à nu, en empattements. */
// Déclare le composant Bubble : l'auteur, l'erreur, les actions faites et le texte.
const Bubble = ({ from, error, done, children }) => (
  // Le bloc du message (début de la balise).
  <Box
    // Message de l'utilisateur…
    sx={from === 'user'
      // … pastille grise alignée à droite, de 85 % de la largeur au plus…
      ? { alignSelf: 'flex-end', maxWidth: '85%', px: 1.5, py: 0.9, borderRadius: '14px', bgcolor: C.row }
      // … réponse de Claude : sur toute la largeur, avec un trait rouge à gauche en cas d'erreur.
      : { alignSelf: 'stretch', px: 0.5, py: 0.25, ...(error ? { pl: 1.25, borderLeft: `2px solid ${C.error}` } : {}) }}
  // Fin de la balise ouvrante.
  >
    {/* L'auteur du message, pour les lecteurs d'écran seulement. */}
    <Typography component="span" sx={visuallyHidden}>{from === 'user' ? 'Vous : ' : 'Claude : '}</Typography>
    {/* S'il y a un texte (début). */}
    {children && (
      // Le texte : retours à la ligne gardés, rouge en cas d'erreur, police et taille selon l'auteur.
      <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: error ? C.error : C.text, fontFamily: from === 'user' ? SANS : SERIF, fontSize: from === 'user' ? 14 : 15, lineHeight: 1.5 }}>
        {/* Son contenu. */}
        {children}
      {/* Fin du texte. */}
      </Typography>
    // Fin du cas.
    )}
    {/* S'il y a des actions faites (début). */}
    {done?.length > 0 && (
      // Rangée d'étiquettes, nommée pour les lecteurs d'écran.
      <Stack direction="row" useFlexGap spacing={0.5} sx={{ flexWrap: 'wrap', mt: children ? 0.75 : 0 }} aria-label="Actions effectuées">
        {/* Une étiquette par action, précédée d'une coche. */}
        {done.map((label, i) => <Chip key={i} size="small" variant="outlined" icon={<CheckIcon />} label={label} sx={{ color: C.muted, borderColor: C.border, fontFamily: SANS }} />)}
      {/* Fin de la rangée. */}
      </Stack>
    // Fin du cas.
    )}
  {/* Fin du bloc du message. */}
  </Box>
// Fin de Bubble.
);

/** Texte lu par les lecteurs d'écran, absent de l'affichage. */
// Style d'un texte invisible à l'écran mais lu par les lecteurs d'écran.
const visuallyHidden = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' };

/** Ligne cliquable, comme une entrée de menu : texte à gauche, fond gris au survol et au clavier. */
// Déclare le composant Row : le contenu et les autres propriétés.
const Row = ({ children, ...props }) => (
  // Le bouton de la ligne (début de la balise).
  <ButtonBase
    // Les propriétés reçues.
    {...props}
    // Début du style.
    sx={{
      // Texte à gauche, toute la largeur, coins arrondis.
      justifyContent: 'flex-start', textAlign: 'left', width: '100%', px: 1.25, py: 0.8, borderRadius: '8px',
      // Couleur et police du texte.
      color: C.text, fontFamily: SANS, fontSize: 14, lineHeight: 1.35,
      // Au survol ou au focus clavier : fond gris.
      '&:hover, &.Mui-focusVisible': { bgcolor: C.row },
      // Désactivée : texte atténué.
      '&.Mui-disabled': { color: C.muted },
    // Fin du style.
    }}
  // Fin de la balise ouvrante.
  >
    {/* Le contenu. */}
    {children}
  {/* Fin du bouton. */}
  </ButtonBase>
// Fin de Row.
);

/**
 * Menu « Claude » : panneau de conversation avec l'assistant, jamais modal. Il n'y a ni voile ni blocage : pendant
 * tout l'échange, l'utilisateur continue de tourner le globe, de zoomer et d'appuyer sur les boutons, et voit
 * l'assistant agir sur la scène en même temps.
 *
 * Deux positions, choisies par `placement` :
 *  - « popper » : petit menu déroulant ancré au bouton « Claude » de la barre d'outils (position d'origine) ;
 *  - « hud »    : posé à la place de la navigation — rail de gauche sur ordinateur, bande du bas sur téléphone —
 *                 pour que le déplacement vers les astres se demande à Claude. La navigation reste accessible par
 *                 son bouton.
 *
 * Sur téléphone, le panneau se réduit à une barre de recherche avec le logo : les réponses ne sont pas affichées,
 * l'écran restant à la scène. Les actions demandées, elles, s'exécutent comme sur ordinateur.
 *
 * Conversation avec le plus petit modèle de Claude (Haiku), relayée par le serveur (POST /assistant/messages) qui
 * garde la clé de l'API.
 * Tant que la clé n'est pas configurée sur le serveur (GET /assistant/config → enabled: false), la fenêtre reste en
 * démonstration : chaque message reçoit la même réponse fixe et rien n'est envoyé.
 * L'assistant peut aussi agir sur l'interface : le serveur renvoie des actions (aller sur un astre, ouvrir une fenêtre,
 * régler l'affichage…) que `onAction` exécute avec les fonctions des boutons existants ; chaque action faite est
 * affichée sous la réponse. Une action hors de la liste autorisée est ignorée.
 */
// Déclare et exporte le composant Assistant : ouverture, ancrage, position, décalage, fermeture, navigation et actions.
export function Assistant({ open, anchorEl, onClose, onAction, onNavigator, placement = 'popper', shifted = false }) {
  // Lit le mode compact.
  const { compact } = useViewport();
  // État : assistant configuré sur le serveur (null tant qu'on ne le sait pas).
  const [enabled, setEnabled] = useState(null); // null = pas encore su
  // État : les messages de la conversation.
  const [messages, setMessages] = useState([]);
  // État : le texte en cours de saisie.
  const [text, setText] = useState('');
  // État : une réponse est attendue.
  const [busy, setBusy] = useState(false);
  // Référence vers la fin de la conversation, pour y faire défiler.
  const endRef = useRef(null);
  // Référence : vrai tant que le composant est monté.
  const alive = useRef(true);
  // Référence : la table des éléments du dernier relevé, par identifiant, pour exécuter un clic demandé.
  const inventory = useRef(new Map());
  // La met à vrai au montage et à faux au démontage.
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  /**
   * Exécute une action demandée par le modèle. Le clic sur un élément de la page est fait ici, où se trouve la
   * table du dernier relevé ; toutes les autres actions partent au parent, qui les revalide contre sa liste fermée.
   *
   * L'élément est recherché par son identifiant de relevé, puis vérifié : s'il a quitté la page entre l'envoi et
   * la réponse — le visiteur a changé d'écran entre-temps — le clic est abandonné plutôt que porté à l'aveugle.
   */
  // Déclare runAction : reçoit l'action et renvoie son libellé, ou null si elle est refusée.
  const runAction = (action) => {
    // Action autre qu'un clic sur un élément : le parent s'en occupe.
    if (action?.name !== 'agir_sur_un_element') return onAction?.(action) ?? null;
    // L'identifiant demandé.
    const id = action?.input?.element;
    // L'élément du dernier relevé portant cet identifiant.
    const el = typeof id === 'string' ? inventory.current.get(id) : null;
    // Identifiant inconnu : refusé, rien n'est cliqué.
    if (!el) return null;
    // Élément qui a quitté la page : refusé, l'écran a changé depuis le relevé.
    if (!globalThis.document?.contains?.(el)) return null;
    // Élément désactivé : refusé, le clic n'aurait aucun effet.
    if (el.disabled || el.getAttribute?.('aria-disabled') === 'true') return null;
    // Clique l'élément, comme le ferait le visiteur.
    el.click?.();
    // Renvoie le libellé de l'action faite, avec le nom de l'élément cliqué.
    return `Clic sur « ${el.getAttribute?.('aria-label') || el.getAttribute?.('title') || (el.textContent || '').trim().slice(0, 40) || id} »`;
  // Fin de runAction.
  };

  // À l'ouverture : l'assistant est-il configuré sur le serveur ?
  // Effet relancé à l'ouverture.
  useEffect(() => {
    // Menu fermé : rien à faire.
    if (!open) return undefined;
    // Crée un contrôleur d'annulation.
    const ctrl = new AbortController();
    // Demande la configuration de l'assistant.
    fetchAssistantConfig(ctrl.signal)
      // Réussite : note s'il est activé.
      .then((c) => setEnabled(Boolean(c?.enabled)))
      // Échec, sauf annulation volontaire : considéré comme non activé.
      .catch((e) => { if (e.name !== 'AbortError') setEnabled(false); });
    // Nettoyage : annule la requête en cours.
    return () => ctrl.abort();
  // Fin de l'effet ; dépendance : l'ouverture.
  }, [open]);

  // Échap ferme le menu (sauf si une autre fenêtre a déjà traité la touche).
  // Effet de la touche Échap.
  useEffect(() => {
    // Menu fermé : rien à faire.
    if (!open) return undefined;
    // onKey : Échap ferme le menu, sauf si la touche a déjà été traitée.
    const onKey = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) onClose?.(); };
    // Écoute les touches sur toute la fenêtre.
    window.addEventListener('keydown', onKey);
    // Nettoyage : retire l'écouteur.
    return () => window.removeEventListener('keydown', onKey);
  // Fin de l'effet ; dépendances : l'ouverture et la fermeture.
  }, [open, onClose]);

  // À chaque nouveau message, fait défiler jusqu'à la fin de la conversation.
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ block: 'nearest' }); }, [open, messages, busy]);

  // Déclare send : envoie une question (celle donnée, sinon le texte saisi).
  const send = async (value) => {
    // La question, sans espaces autour, limitée à 1 000 caractères.
    const question = String(value ?? text).trim().slice(0, MAX_CHARS);
    // Question vide ou réponse en attente : rien à faire.
    if (!question || busy) return;
    // Historique à envoyer : les messages sans erreur, plus la question.
    const history = [...messages.filter((m) => !m.error), { from: 'user', text: question }];
    // Ajoute la question à la conversation affichée.
    setMessages((m) => [...m, { from: 'user', text: question }]);
    // Vide le champ.
    setText('');
    // Si l'assistant n'est pas branché.
    if (!enabled) {
      // Ajoute la réponse fixe de démonstration.
      setMessages((m) => [...m, { from: 'claude', text: NOT_CONNECTED }]);
      // Rien n'est envoyé.
      return;
    // Fin du cas.
    }
    // Note qu'une réponse est attendue.
    setBusy(true);
    // Début du bloc protégé.
    try {
      // Les 12 derniers messages, au format de l'API (rôle et contenu limité à 1 000 caractères).
      const payload = history.slice(-MAX_HISTORY).map((m) => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.text.slice(0, MAX_CHARS) }));
      // Relève les éléments actionnables de l'écran : c'est ainsi que le modèle voit l'interface.
      const { elements, byId } = collectInventory();
      // Garde la table du relevé, pour retrouver un élément que le modèle désignerait.
      inventory.current = byId;
      // Envoie la conversation et l'inventaire, et attend la réponse et les actions (aucune par défaut).
      const { reply, actions = [] } = await askAssistant(payload, elements);
      // Composant démonté entre-temps : on s'arrête.
      if (!alive.current) return;
      // Actions demandées par le modèle : exécutées dans l'ordre, celles qui sont refusées sont ignorées.
      // Exécute chaque action ; garde le libellé de celles qui sont acceptées.
      const done = actions.map((a) => runAction(a)).filter(Boolean);
      // Texte affiché : la réponse, sinon « C'est fait. » s'il y a eu des actions, sinon un refus.
      const shown = reply || (done.length ? 'C’est fait.' : 'Je ne peux pas faire cette action dans l’interface.');
      // Ajoute la réponse à la conversation, avec les actions faites.
      setMessages((m) => [...m, { from: 'claude', text: shown, done }]);
    // En cas d'échec.
    } catch (e) {
      // Si le composant est toujours monté : ajoute un message d'erreur.
      if (alive.current) setMessages((m) => [...m, { from: 'claude', error: true, text: e.message || 'L’assistant n’a pas pu répondre.' }]);
    // Dans tous les cas.
    } finally {
      // Si le composant est toujours monté : plus de réponse attendue.
      if (alive.current) setBusy(false);
    // Fin du bloc.
    }
  // Fin de send.
  };

  // Menu fermé : rien n'est affiché.
  if (!open) return null;

  // Petit menu déroulant : ancré au bouton « Claude » de la barre d'outils, il se déroule au-dessus ; sur téléphone,
  // ancré au bouton ⋯ du haut de l'écran, il se déroule dessous. Pas de voile ni de blocage : la scène reste visible
  // et utilisable. Sans bouton d'ancrage (bouton disparu de l'écran), il se pose en bas à gauche.
  // Hauteur de ce qui occupe le bas de l'écran.
  const barH = compact ? STRIP_H : DESKTOP_BAR_H; // ce qui occupe le bas de l'écran
  // Hauteur réservée hors du menu : bandeau titre et bande en mode compact, barre d'outils sinon.
  const reserved = compact ? TITLE_H + STRIP_H : DESKTOP_BAR_H;
  // Position « hud » : le panneau prend la place de la navigation au lieu de se dérouler sous un bouton.
  const hud = placement === 'hud';
  // Ancré seulement en position « popper », et si le bouton d'ancrage est encore dans la page.
  const anchored = !hud && Boolean(anchorEl && document.body.contains(anchorEl));
  /**
   * Mode réduit du téléphone : le panneau n'est plus qu'une barre de recherche avec le logo. Les réponses ne sont
   * pas affichées — l'écran reste à la scène — mais les actions demandées s'exécutent quand même.
   */
  // Mode réduit : sur téléphone.
  const bare = compact;
  /**
   * Décalage quand l'arborescence des astres est ouverte : elle occupe exactement la même place (rail de gauche sur
   * ordinateur, bande du bas sur téléphone). Le panneau s'écarte alors pour que les deux restent utilisables.
   */
  // Place prise par l'arborescence quand elle est ouverte : la largeur du rail, ou la hauteur de la bande.
  const shift = shifted ? (compact ? STRIP_H : RAIL + 12) : 0;
  // Style de position du panneau, selon le mode (début).
  const placed = hud
    // Position « hud » : sur téléphone, la bande du bas sur toute la largeur ; sur ordinateur, le rail de gauche, centré.
    ? (compact
      // Téléphone : collé en bas, toute la largeur, au-dessus de la scène et de l'arborescence si elle est ouverte.
      ? { position: 'fixed', left: 0, right: 0, bottom: `calc(${shift}px + ${safe('bottom')})`, pb: shift ? 0 : safe('bottom'), zIndex: (t) => t.zIndex.toolbar - 5 }
      // Ordinateur : à gauche, centré en hauteur, à la largeur du rail des astres, écarté de l'arborescence ouverte.
      : { position: 'fixed', left: `calc(${edge('left')} + ${shift}px)`, top: '50%', transform: 'translateY(-50%)', zIndex: (t) => t.zIndex.hud })
    // Position « popper » sans ancrage : fixé en bas à gauche, au-dessus de la barre du bas.
    : (anchored ? {} : { position: 'fixed', left: edge('left', 8), bottom: `calc(${barH}px + ${safe('bottom')} + 16px)`, zIndex: (t) => t.zIndex.toolbar + 5 });
  // Le panneau du menu (début).
  const panel = (
    // La carte (début de la balise).
    <Paper
      // Rendue en balise section.
      component="section"
      // Ombre marquée.
      elevation={8}
      // Nom pour les lecteurs d'écran.
      aria-label="Claude"
      // Marque le panneau : ses propres boutons sont exclus de l'inventaire, pour qu'il ne se clique pas lui-même.
      data-claude-panel=""
      // Début du style.
      sx={{
        // En colonne, sans débordement.
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        // Couleurs propres au menu, bordure fine, coins arrondis, police bâton.
        bgcolor: C.panel, color: C.text, backgroundImage: 'none', border: `1px solid ${C.border}`, borderRadius: '14px', fontFamily: SANS,
        // Largeur : toute la bande du bas en mode réduit, celle du rail en position « hud », 340 px sinon.
        width: bare && hud ? 'auto' : compact ? 'min(340px, calc(100vw - 16px))' : hud ? RAIL : 340,
        // Mode réduit : pas d'angles arrondis en bas, la barre est collée au bord de l'écran.
        ...(bare && hud ? { borderRadius: '14px 14px 0 0', borderBottom: 'none' } : {}),
        // Téléphone : au plus 46 % de la hauteur, le menu est en haut et le clavier en bas, la scène reste visible entre.
        // Hauteur maximale : aucune contrainte en mode réduit (une seule ligne), selon l'écran sinon.
        ...(bare ? {} : { maxHeight: compact ? `min(340px, 46dvh, calc(100dvh - ${reserved}px - 24px))` : `min(440px, calc(100dvh - ${reserved}px - 96px))` }),
        // La position calculée plus haut.
        ...placed,
      // Fin du style.
      }}
    // Fin de la balise ouvrante.
    >
      {/* L'en-tête du menu, souligné d'un filet ; masqué en mode réduit, où le logo passe dans la barre de saisie (début). */}
      {!bare && (
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, py: 1.1, borderBottom: `1px solid ${C.border}` }}>
        {/* Le logo. */}
        <Box component="img" src="/claude-logo.png" alt="" sx={{ width: 20, height: 20, flex: 'none' }} />
        {/* Le titre « Claude », en empattements. */}
        <Typography component="h2" sx={{ flex: 1, fontFamily: SERIF, fontSize: 19, lineHeight: 1.2, color: C.text }}>Claude</Typography>
        {/* L'étiquette « Démonstration », si l'assistant n'est pas branché. */}
        {enabled === false && <Chip size="small" variant="outlined" label="Démonstration" sx={{ color: C.muted, borderColor: C.border, fontFamily: SANS }} />}
        {/* Le bouton de l'arborescence des astres, quand le parent en propose une. */}
        {onNavigator && (
          <Chip
            // Petite pastille cliquable.
            size="small" variant="outlined" clickable
            // Son libellé.
            label="Astres"
            // Au clic : ouvre ou ferme l'arborescence.
            onClick={onNavigator}
            // Infobulle.
            title="Arborescence des astres"
            // Couleurs du menu, qui s'éclaircissent au survol.
            sx={{ color: C.muted, borderColor: C.border, fontFamily: SANS, '&:hover': { bgcolor: C.row, color: C.text } }}
          // Fin de la pastille.
          />
        )}
        {/* Fin du bouton de l'arborescence. */}
        {/* Le bouton de fermeture (début de la balise). */}
        <ButtonBase
          // Au clic : ferme le menu.
          onClick={onClose}
          // Nom pour les lecteurs d'écran.
          aria-label="Fermer"
          // Carré arrondi de 28 px, qui s'éclaire au survol.
          sx={{ width: 28, height: 28, borderRadius: '8px', color: C.muted, fontSize: 16, '&:hover, &.Mui-focusVisible': { bgcolor: C.row, color: C.text } }}
        // Fin de la balise ouvrante.
        >
          {/* La croix. */}
          <CloseIcon sx={{ fontSize: 16 }} />
        {/* Fin du bouton. */}
        </ButtonBase>
      {/* Fin de l'en-tête. */}
      </Stack>
      )}
      {/* Fin de l'en-tête conditionnel. */}
      {/* Zone de conversation, qui défile sans entraîner la page ; absente en mode réduit (début). */}
      {!bare && (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, px: 1.25, pt: 1.25, pb: 1.25, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
        {/* Si l'assistant n'est pas branché (début). */}
        {enabled === false && (
          // Encadré d'avertissement (début de la balise).
          <Typography role="status" sx={{ px: 1.25, py: 1, borderRadius: '10px', bgcolor: C.field, border: `1px solid ${C.border}`, color: C.muted, fontFamily: SANS, fontSize: 13 }}>
            {/* Son texte. */}
            Fenêtre de démonstration : l’assistant n’est pas encore branché, aucune réponse n’est générée.
          {/* Fin de l'encadré. */}
          </Typography>
        // Fin du cas.
        )}

        {/* La conversation, annoncée aux lecteurs d'écran ; hauteur minimale tant qu'elle est vide, hors mode compact. */}
        <Stack spacing={1} sx={{ minHeight: messages.length === 0 ? (compact ? 0 : 72) : 0 }} aria-live="polite">
          {/* S'il n'y a aucun message (début). */}
          {messages.length === 0 ? (
            // Bloc d'accueil, centré.
            <Box sx={{ m: 'auto', textAlign: 'center', px: 2 }}>
              {/* L'invitation. */}
              <Typography sx={{ fontFamily: SERIF, fontSize: 18, lineHeight: 1.3, color: C.text }}>Posez une question ou demandez une action</Typography>
              {/* L'avertissement (début de la balise). */}
              <Typography sx={{ mt: 0.5, fontFamily: SANS, fontSize: 13, color: C.muted }}>
                {/* Son texte. */}
                Les réponses sont générées par une IA et peuvent contenir des erreurs.
              {/* Fin de l'avertissement. */}
              </Typography>
            {/* Fin du bloc d'accueil. */}
            </Box>
          // Sinon (début).
          ) : (
            // Une bulle par message.
            messages.map((m, i) => <Bubble key={i} from={m.from} error={m.error} done={m.done}>{m.text}</Bubble>)
          // Fin du choix.
          )}
          {/* Pendant l'attente d'une réponse (début). */}
          {busy && (
            // Ligne d'attente, alignée à gauche.
            <Stack direction="row" alignItems="center" spacing={1} sx={{ alignSelf: 'flex-start', px: 1 }}>
              {/* Une petite roue orange. */}
              <CircularProgress size={14} sx={{ color: C.accent }} />
              {/* Le texte « Claude répond… ». */}
              <Typography sx={{ fontFamily: SANS, fontSize: 13, color: C.muted }}>Claude répond…</Typography>
            {/* Fin de la ligne d'attente. */}
            </Stack>
          // Fin du cas.
          )}
          {/* Le repère de fin de conversation. */}
          <Box ref={endRef} />
        {/* Fin de la conversation. */}
        </Stack>

        {/* Suggestions : seulement avant le premier message, ensuite elles laissent la place à la conversation. */}
        {/* Avant le premier message (début). */}
        {messages.length === 0 && (
          // La liste des suggestions.
          <Stack spacing={0.25}>
            {/* Une ligne par suggestion (deux seulement en mode compact) ; un clic l'envoie. */}
            {(compact ? SUGGESTIONS.slice(0, 2) : SUGGESTIONS).map((s) => <Row key={s} disabled={busy} onClick={() => send(s)}>{s}</Row>)}
          {/* Fin de la liste. */}
          </Stack>
        // Fin du cas.
        )}
        {/* Avant le premier message (début). */}
        {messages.length === 0 && (
          // Note de confidentialité (début de la balise).
          <Typography sx={{ fontFamily: SANS, fontSize: 11.5, lineHeight: 1.4, color: C.muted }}>
            {/* Son texte. */}
            Vos messages sont envoyés à l’API Claude d’Anthropic pour générer la réponse. N’y mettez pas d’informations personnelles.
          {/* Fin de la note. */}
          </Typography>
        // Fin du cas.
        )}
      {/* Fin de la zone de conversation. */}
      </Box>
      )}
      {/* Fin de la zone de conversation conditionnelle. */}
      {/* Zone de saisie ; sans filet en mode réduit, où elle est seule dans le panneau. */}
      <Box sx={{ flex: 'none', px: 1.25, py: 1, ...(bare ? {} : { borderTop: `1px solid ${C.border}` }) }}>
        {/* Le formulaire : à la validation, envoie le texte sans recharger la page. */}
        <Stack component="form" direction="row" spacing={1} alignItems="center" onSubmit={(e) => { e.preventDefault(); send(); }}>
          {/* Mode réduit : le logo tient la place de l'en-tête, à gauche de la barre de recherche. */}
          {bare && <Box component="img" src="/claude-logo.png" alt="Claude" sx={{ width: 22, height: 22, flex: 'none', ml: 0.25 }} />}
          {/* Le champ de texte (début de la balise). */}
          <TextField
            // Petite taille.
            size="small"
            // Toute la largeur.
            fullWidth
            // Le texte saisi.
            value={text}
            // À chaque frappe : met le texte à jour.
            onChange={(e) => setText(e.target.value)}
            // Texte indicatif.
            placeholder="Écrire à Claude…"
            // Nom pour les lecteurs d'écran et longueur maximale.
            slotProps={{ htmlInput: { 'aria-label': 'Message pour Claude', maxLength: MAX_CHARS } }}
            // Début du style.
            sx={{
              // Le cadre du champ (début).
              '& .MuiOutlinedInput-root': {
                // Couleurs du menu, coins arrondis, texte de 16 px en mode compact.
                bgcolor: C.field, color: C.text, borderRadius: '12px', fontFamily: SANS, fontSize: compact ? 16 : 14,
                // Bordure au repos.
                '& fieldset': { borderColor: C.border },
                // Bordure au survol.
                '&:hover fieldset': { borderColor: C.muted },
                // Bordure au focus, sans épaississement.
                '&.Mui-focused fieldset': { borderColor: C.muted, borderWidth: 1 },
              // Fin du cadre.
              },
              // Couleur du texte indicatif.
              '& input::placeholder': { color: C.muted, opacity: 1 },
            // Fin du style.
            }}
          // Fin du champ.
          />
          {/* Le bouton d'envoi (début de la balise). */}
          <ButtonBase
            // Il valide le formulaire.
            type="submit"
            // Désactivé pendant l'attente ou si le texte est vide.
            disabled={busy || !text.trim()}
            // Nom pour les lecteurs d'écran.
            aria-label="Envoyer"
            // Début du style.
            sx={{
              // Carré arrondi de 40 px, orange, à flèche sombre.
              flex: 'none', width: 40, height: 40, borderRadius: '12px', bgcolor: C.accent, color: '#1f1e1d', fontSize: 18, fontWeight: 700,
              // Au survol ou au focus : orange plus clair.
              '&:hover, &.Mui-focusVisible': { bgcolor: '#e08a6d' },
              // Désactivé : gris.
              '&.Mui-disabled': { bgcolor: C.row, color: C.muted },
            // Fin du style.
            }}
          // Fin de la balise ouvrante.
          >
            {/* La flèche d'envoi. */}
            <SendIcon sx={{ fontSize: 20 }} />
          {/* Fin du bouton. */}
          </ButtonBase>
        {/* Fin du formulaire. */}
        </Stack>
      {/* Fin de la zone de saisie. */}
      </Box>
    {/* Fin de la carte. */}
    </Paper>
  // Fin du panneau.
  );

  // Sans ancrage : le panneau seul.
  if (!anchored) return panel;
  // Sinon (début du rendu).
  return (
    // Le bloc ancré (début de la balise).
    <Popper
      // Toujours ouvert.
      open
      // Ancré au bouton.
      anchorEl={anchorEl}
      // Sous le bouton en mode compact, au-dessus sinon.
      placement={compact ? 'bottom-end' : 'top-start'}
      // Écart de 10 px, retournement et maintien dans l'écran, avec 8 px de marge.
      modifiers={[{ name: 'offset', options: { offset: [0, 10] } }, { name: 'flip', options: { padding: 8 } }, { name: 'preventOverflow', options: { padding: 8, altAxis: true, tether: false } }]}
      // Au-dessus des barres d'outils.
      sx={{ zIndex: (t) => t.zIndex.toolbar + 5 }}
    // Fin de la balise ouvrante.
    >
      {/* Le panneau. */}
      {panel}
    {/* Fin du bloc ancré. */}
    </Popper>
  // Fin du rendu.
  );
// Fin de Assistant.
}
