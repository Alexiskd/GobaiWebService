// Crochets React.
import { useCallback, useEffect, useState } from 'react';
// Éléments d'interface.
import { Alert, Box, Dialog, Divider, Link, Paper, Typography } from '@mui/material';
// Catégorie d'écran.
import { useViewport } from '@/composante/hooks/useViewport';
// Compte Gobai Space : un seul compte pour tout le site.
import { useCompte } from '@/composante/hooks/useCompte';
// Formulaire de connexion, partagé avec la fenêtre « Contribuer ».
import { CompteBox } from '@/composante/components/ui/CompteBox';
// En-tête commun des fenêtres.
import { PanelHeader } from '../../ui/PanelHeader';
// Icône de lien externe.
import { OpenInNewIcon } from '../../ui/icons';
// API de la boutique.
import { claimLicence, createOrder, fetchCatalogue, fetchExportBodies, fetchLicences, parsePurchaseReturn } from '@/moteur/api/store';
// Adresses publiques de l'API et de sa documentation.
import { PUBLIC_API_BASE, PUBLIC_DOCS_URL } from '@/moteur/api/client';
// Mise en forme du catalogue et explication des réglages manquants.
import { missingLabel, sectionsOf } from './sections';
// Carte d'un article.
import { ArticleCard } from './ArticleCard';
// Les achats du compte.
import { MesAchats } from './MesAchats';

/**
 * Adresse de base de l'API, telle qu'elle apparaît dans les exemples de code et dans les liens de la page.
 * C'est l'adresse publique du service, pas celle de la page : un acheteur doit pouvoir copier l'exemple tel
 * quel, même s'il lit la boutique depuis une préproduction.
 */
const API = PUBLIC_API_BASE;

/** Nombre d'heures retenu pour une location : un entier d'au moins une heure et d'au plus un mois. */
const clampHours = (value) => Math.max(1, Math.min(744, Math.floor(Number(value) || 1)));

/**
 * Boutique des exports : ce qui est vendu, le paiement, et les jetons d'accès du compte connecté.
 *
 * **Ce qui s'achète**, c'est la récupération des données, et chaque article d'astre donne les deux formes :
 * le modèle 3D complet au format GLB (ouvert directement par three.js, Blender ou un visualiseur en ligne) et
 * le fond de carte de l'astre assemblé en une seule image. À part, loué à l'heure : le calcul d'orbite, et la
 * position apparente du Soleil. La consultation du site, elle, reste libre et ne demande rien.
 *
 * **Un achat se fait depuis un compte connecté** : la page de paiement Stripe est créée pour ce compte, et lui
 * seul peut en récupérer le jeton. Les achats sont enregistrés côté serveur, donc les jetons se retrouvent sur
 * n'importe quel appareil en se connectant — sans jamais prolonger la durée payée.
 *
 * **La boutique ne s'affiche qu'une fois connecté** : sans session, la fenêtre ne montre que le bloc de
 * connexion. Ni catalogue, ni prix, ni adresses de l'API — rien qui n'ait de sens sans compte, puisqu'aucun
 * achat ne peut aboutir et qu'aucune clé ne peut être délivrée. Le bouton de la barre d'outils reste visible,
 * lui : c'est par cette fenêtre que l'on ouvre un compte.
 */
export function Boutique({ open, onClose }) {
  // Petit écran : la fenêtre prend tout l'écran.
  const { compact } = useViewport();
  // Le compte connecté, vérifié à chaque ouverture.
  const compte = useCompte({ open });
  // Le catalogue, une fois lu.
  const [catalogue, setCatalogue] = useState(null);
  // Les astres exportables, avec ce que chacun a réellement à vendre.
  const [bodies, setBodies] = useState([]);
  // Les achats du compte, rechargés depuis le serveur après authentification.
  const [licences, setLicences] = useState([]);
  // Les achats sont-ils enregistrés durablement sur le serveur ?
  const [persistent, setPersistent] = useState(null);
  // Article en cours d'achat.
  const [busy, setBusy] = useState('');
  // Nombre d'heures choisi pour chaque article loué à l'heure.
  const [hours, setHours] = useState({});
  // Paiement revenu de Stripe mais pas encore réclamé, faute de session ouverte.
  const [pending, setPending] = useState('');
  // Dernier message d'erreur et dernière information.
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Le jeton de session du compte, s'il y en a un.
  const token = compte.token;

  // À l'ouverture : lit le catalogue et les astres.
  useEffect(() => {
    // Fenêtre fermée : rien à lire.
    if (!open) return;
    // Le catalogue ; un échec est montré tel quel.
    fetchCatalogue().then(setCatalogue).catch((e) => setError(e.message || 'Catalogue indisponible.'));
    // Les astres : un détail d'affichage, dont l'absence ne bloque rien.
    fetchExportBodies().then((r) => setBodies(r.items || []));
  // À chaque ouverture.
  }, [open]);

  // Relit les achats du compte.
  const reload = useCallback(async (sessionToken) => {
    // Sans session : aucun achat à montrer.
    if (!sessionToken) { setLicences([]); setPersistent(null); return; }
    // Essaie.
    try {
      // Les achats.
      const { items, persistent: durable } = await fetchLicences(sessionToken);
      // Gardés pour l'affichage.
      setLicences(items || []);
      setPersistent(durable);
    // Refus du serveur : les achats restent vides, le message est montré.
    } catch (e) {
      // Une session périmée est déjà traitée par useCompte : on ne montre que les autres refus.
      if (e.status !== 401) setError(e.message || 'Impossible de lire vos achats.');
    // Fin de l'essai.
    }
  // Sans dépendance.
  }, []);

  // À l'ouverture et à chaque changement de compte : relit les achats.
  useEffect(() => {
    // Fenêtre fermée : rien à faire.
    if (!open) return;
    // Les achats du compte.
    void reload(token);
  // À chaque ouverture et à chaque changement de jeton.
  }, [open, token, reload]);

  // Récupère le jeton d'un paiement abouti.
  const claim = useCallback(async (sessionToken, id) => {
    // Attente.
    setBusy('claim');
    // Essaie.
    try {
      // Le jeton.
      const licence = await claimLicence(sessionToken, id);
      // Le jeton reste uniquement dans l'état React courant ; il n'est pas écrit dans le stockage Chrome.
      // Le paiement est réclamé : il n'attend plus.
      setPending('');
      // Message de confirmation.
      setNotice(`Paiement reçu : ${licence.product.label}. Le jeton est ci-dessous, et vous le retrouverez en vous connectant.`);
      // Plus d'erreur.
      setError('');
      // Et la liste du compte est relue.
      await reload(sessionToken);
    // Refus du serveur.
    } catch (e) {
      // Message.
      setError(e.message || 'Impossible de récupérer le jeton d’accès.');
    // Dans tous les cas.
    } finally {
      // Fin de l'attente.
      setBusy('');
    // Fin de l'essai.
    }
  // Dépend de la relecture.
  }, [reload]);

  // Au retour de Stripe : récupère le jeton, et nettoie l'adresse.
  useEffect(() => {
    // Fenêtre fermée : on attend son ouverture.
    if (!open) return;
    // Le retour, s'il y en a un.
    const back = parsePurchaseReturn();
    // Aucun retour.
    if (!back) return;
    // Paiement abouti : on le réclame tout de suite si une session est ouverte, sinon on le met en attente.
    if (back.kind === 'paid') setPending(back.id);
    // Abandon : on le dit simplement.
    else setNotice('Paiement abandonné : rien n’a été prélevé.');
    // L'adresse est nettoyée, pour ne pas rejouer le retour à chaque rechargement.
    try {
      // Retire les deux paramètres.
      const url = new URL(globalThis.location.href);
      url.searchParams.delete('achat');
      url.searchParams.delete('session_id');
      globalThis.history?.replaceState?.(null, '', url.toString());
    // Historique indisponible : sans importance.
    } catch { /* rien */ }
  // À l'ouverture.
  }, [open]);

  // Un paiement en attente et une session ouverte : le jeton est réclamé.
  useEffect(() => {
    // Il faut les deux, et ne pas être déjà en train de le faire.
    if (!open || !pending || !token || busy === 'claim') return;
    // La réclamation.
    void claim(token, pending);
  // À chaque changement de l'un des trois.
  }, [open, pending, token, busy, claim]);

  // Achat d'un article : crée la page de paiement et y envoie l'acheteur.
  const buy = async (product) => {
    // Sans session, rien à faire : le bouton le dit déjà.
    if (!token) { setError('Connectez-vous pour acheter : la page de paiement est créée pour votre compte.'); return; }
    // Attente sur cet article.
    setBusy(product.id);
    setError('');
    // Essaie.
    try {
      // La page de paiement du compte connecté.
      const order = await createOrder(token, product.id, product.hourly ? clampHours(hours[product.id]) : 1);
      // Départ vers Stripe.
      globalThis.location.assign(order.url);
    // Refus du serveur.
    } catch (e) {
      // Message, et fin de l'attente.
      setError(e.message || 'Impossible d’ouvrir la page de paiement.');
      setBusy('');
    // Fin de l'essai.
    }
  // Fin de buy.
  };

  // Les achats affichés proviennent exclusivement du serveur après authentification.
  const shown = licences;
  // L'achat en cours pour un article, s'il y en a un.
  const ownedOf = (id) => shown.find((l) => l.product?.id === id) ?? null;
  // Le catalogue rangé en rayons.
  const sections = sectionsOf(catalogue?.products ?? [], bodies);
  // Le paiement est-il ouvert et le compte connecté ?
  const canBuy = Boolean(catalogue?.enabled && token);

  // Début du rendu.
  return (
    // La fenêtre.
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={compact}
      fullWidth
      maxWidth="md"
      aria-label="Boutique des exports"
      slotProps={{ paper: { sx: { display: 'flex', flexDirection: 'column', maxHeight: compact ? 'none' : 'min(88vh, 900px)' } } }}
    >
      {/* En-tête. */}
      <PanelHeader kicker="Exports de données" title="Boutique" onClose={onClose} />
      {/* Corps défilant. */}
      <Box sx={{ overflowY: 'auto', overscrollBehavior: 'contain', p: 2, display: 'grid', gap: 2, minHeight: 0 }}>
        {/* Ce qui est vendu, et ce qui ne l'est pas. */}
        <Typography variant="body2" color="text.secondary">
          {/* Le texte. */}
          La consultation du site est libre et le restera. Ce qui s’achète ici, c’est la récupération des
          données, et chaque article d’astre donne les <strong>deux formes</strong> : le modèle 3D complet au
          format GLB, aux dimensions réelles en kilomètres, que three.js ou Blender ouvrent directement, et le
          fond de carte de l’astre assemblé en une seule image. À part, loués à l’heure : le calcul d’orbite et
          la position apparente du Soleil.
        {/* Fin du texte. */}
        </Typography>
        {/* Le compte : c'est lui qui achète, et sans lui la fenêtre s'arrête là. */}
        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'transparent' }}>
          {/* Le formulaire ou le compte connecté. */}
          <CompteBox compte={compte} hint="Connectez-vous pour voir la boutique : les articles, les prix et vos clés d’API n’apparaissent qu’avec un compte." />
        {/* Fin du compte. */}
        </Paper>
        {/* Paiement revenu de Stripe mais pas encore réclamé : à dire même sans session, c'est ce qui explique
            pourquoi il faut se connecter maintenant. */}
        {pending && !token && (
          // L'avertissement.
          <Alert severity="info">Votre paiement est enregistré. Connectez-vous avec le compte qui l’a fait pour récupérer sa clé.</Alert>
        )}
        {/* Sans session : la fenêtre s'arrête là. */}
        {!token ? (
          // Ce qui attend le visiteur une fois connecté.
          <Typography variant="body2" color="text.secondary">
            {/* Le texte. */}
            Le catalogue, les prix et vos clés d’API s’affichent dès que vous êtes connecté.
          {/* Fin du texte. */}
          </Typography>
        // Connecté : tout le reste de la fenêtre (début).
        ) : (
        // Fragment qui porte la boutique elle-même.
        <>
        {/* Les deux adresses dont un acheteur a besoin : la base de l'API, et sa documentation. */}
        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'transparent', display: 'grid', gap: 1 }}>
          {/* Le titre du bloc. */}
          <Typography component="h3" variant="subtitle2">Votre API</Typography>
          {/* La base de l'API, en texte à espacement fixe, sélectionnable. */}
          <Box sx={{ display: 'grid', gap: 0.25 }}>
            {/* Son intitulé. */}
            <Typography variant="caption" color="text.secondary">Base des appels</Typography>
            {/* L'adresse. */}
            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem', overflowWrap: 'anywhere' }}>{API}</Typography>
          {/* Fin de la base. */}
          </Box>
          {/* La documentation, ouverte dans un nouvel onglet. */}
          <Box sx={{ display: 'grid', gap: 0.25 }}>
            {/* Son intitulé. */}
            <Typography variant="caption" color="text.secondary">Documentation interactive</Typography>
            {/* Le lien : chaque route, ses paramètres, ses réponses, et un bouton pour l'essayer avec votre clé. */}
            <Link href={PUBLIC_DOCS_URL} target="_blank" rel="noreferrer" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', overflowWrap: 'anywhere' }}>
              {/* L'adresse, suivie de l'icône de lien externe. */}
              {PUBLIC_DOCS_URL} <OpenInNewIcon sx={{ fontSize: '0.9rem', verticalAlign: '-0.15em' }} />
            {/* Fin du lien. */}
            </Link>
          {/* Fin de la documentation. */}
          </Box>
          {/* Comment la clé s'emploie. */}
          <Typography variant="caption" color="text.secondary">
            {/* Le texte. */}
            Votre clé est le jeton délivré à l’achat : présentez-la dans l’en-tête
            <Box component="code" sx={{ mx: 0.5 }}>Authorization: Bearer …</Box>
            sur les routes <Box component="code">/export</Box>. Le bouton « Authorize » de la documentation
            l’accepte aussi, pour essayer une route depuis le navigateur.
          {/* Fin du texte. */}
          </Typography>
        {/* Fin du bloc des adresses. */}
        </Paper>
        {/* Paiement fermé : on le dit, on nomme ce qui manque, et on dit à quoi chaque réglage sert. */}
        {catalogue && !catalogue.enabled && (
          // L'avertissement.
          <Alert severity="warning">
            {/* Le constat. */}
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Les achats sont fermés : le paiement n’est pas configuré sur ce serveur.</Typography>
            {/* Un point par réglage manquant, quand le serveur les nomme. */}
            {catalogue.missing?.length > 0 && (
              // La liste.
              <Box component="ul" sx={{ m: 0, mt: 0.75, pl: 2.5, display: 'grid', gap: 0.5 }}>
                {/* Chaque réglage. */}
                {catalogue.missing.map((key) => (
                  // Son nom, puis ce qu'il empêche.
                  <Box component="li" key={key} sx={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
                    {/* Le nom de la variable. */}
                    <Box component="code" sx={{ fontWeight: 700 }}>{key}</Box>
                    {' — '}
                    {/* Ce qu'elle fait. */}
                    {missingLabel(key)}
                  {/* Fin du réglage. */}
                  </Box>
                // Fin des réglages.
                ))}
              {/* Fin de la liste. */}
              </Box>
            )}
          {/* Fin de l'avertissement. */}
          </Alert>
        )}
        {/* Achats gardés en mémoire : ils ne survivront pas à un redémarrage du serveur. */}
        {catalogue?.persistent === false && (
          // L'avertissement.
          <Alert severity="warning">
            {/* Le texte. */}
            Ce serveur garde les achats en mémoire : ils seront perdus à son redémarrage, et les clés délivrées
            ne pourront plus être redemandées. Poser <Box component="code">DATABASE_URL</Box> (une base
            PostgreSQL Render) les rend durables.
          {/* Fin de l'avertissement. */}
          </Alert>
        )}
        {/* Mode test de Stripe. */}
        {catalogue?.enabled && catalogue.environment === 'test' && (
          // L'avertissement.
          <Alert severity="info">Stripe est en mode test : aucun paiement réel n’est prélevé.</Alert>
        )}
        {/* Messages. */}
        {notice && <Alert severity="success" role="status">{notice}</Alert>}
        {error && <Alert severity="error" role="alert">{error}</Alert>}
        {/* Les achats du compte. */}
        {shown.length > 0 && (
          // La section, suivie d'un filet.
          <>
            {/* Les achats. */}
            <MesAchats licences={shown} bodies={bodies} apiBase={API} docsUrl={PUBLIC_DOCS_URL} persistent={persistent} />
            {/* Le filet. */}
            <Divider />
          {/* Fin de la section. */}
          </>
        )}
        {/* Le catalogue. */}
        {!catalogue ? (
          // En cours de lecture.
          <Typography variant="body2" color="text.secondary">Lecture du catalogue…</Typography>
        ) : (
          // Un rayon après l'autre.
          sections.map((section) => (
            // Le rayon.
            <Box component="section" key={section.id} aria-label={section.title} sx={{ display: 'grid', gap: 1 }}>
              {/* Son titre. */}
              <Typography component="h3" variant="subtitle2">{section.title}</Typography>
              {/* Ce qu'il contient. */}
              <Typography variant="body2" color="text.secondary">{section.blurb}</Typography>
              {/* Ses articles, sur deux colonnes dès qu'il y a de la place. */}
              <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } }}>
                {/* Chaque article. */}
                {section.products.map((p) => (
                  // Sa carte.
                  <ArticleCard
                    key={p.id}
                    product={p}
                    owned={ownedOf(p.id)}
                    hours={hours[p.id] ?? 1}
                    onHours={(v) => setHours((h) => ({ ...h, [p.id]: v }))}
                    onBuy={() => buy(p)}
                    busy={busy === p.id}
                    canBuy={canBuy}
                    signedIn={Boolean(token)}
                  />
                // Fin des articles.
                ))}
              {/* Fin de la grille. */}
              </Box>
            {/* Fin du rayon. */}
            </Box>
          // Fin des rayons.
          ))
        )}
        {/* Ce que l'acheteur doit savoir. */}
        <Typography variant="caption" color="text.secondary">
          {/* La note. */}
          Les clés se redemandent en vous connectant : elles ne prolongent jamais la durée payée. Les images
          exportées restent soumises à la licence de leur fournisseur, inscrite dans le fichier et dans
          l’en-tête <code>X-Attribution</code> de chaque export — vérifiez-la avant un usage commercial.
        {/* Fin de la note. */}
        </Typography>
        {/* Fin du fragment de la boutique. */}
        </>
        // Fin du cas « connecté ».
        )}
      {/* Fin du corps. */}
      </Box>
    {/* Fin de la fenêtre. */}
    </Dialog>
  // Fin du rendu.
  );
// Fin de Boutique.
}
