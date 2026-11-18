// Éléments d'interface.
import { Alert, Box, Dialog, Divider, Tab, Tabs, Typography } from '@mui/material';
// Catégorie d'écran.
import { useViewport } from '@/composante/hooks/useViewport';
// En-tête commun des fenêtres.
import { PanelHeader } from '../../ui/PanelHeader';
// Ce qu'attend l'API pour placer un relevé.
import { headerPayload } from '@/moteur/contributions/lasHeader';
// Compte du contributeur et liste des placements.
import { useCompte } from '@/composante/hooks/useCompte';
import { useContributions } from './useContributions';
// Formulaires, carte et calque 3D.
import { CompteBox } from '@/composante/components/ui/CompteBox';
import { LazAnalyse } from './LazAnalyse';
import { PlacementCard } from './PlacementCard';
import { ContributionLayer } from './ContributionLayer';

/** Les trois ordres de la liste, avec leur libellé. */
const SORTS = [['populaire', 'Populaires'], ['recent', 'Récents'], ['meilleur', 'Meilleurs']];

/**
 * Composante « Contribuer » : placer un relevé LiDAR sur le globe, et voter sur le placement des autres.
 *
 * Marche à suivre : créer un compte (un pseudonyme et un mot de passe, sans courriel ni validation), choisir un
 * fichier LAS/LAZ, et publier. L'en-tête du fichier est lu dans le navigateur ; le serveur en calcule la position
 * et, pour une dalle LiDAR HD de l'IGN (Lambert-93), la retrouve au mètre près sans rien demander de plus. Les
 * emprises publiées sont dessinées sur le globe et chacun vote pour dire si le relevé est au bon endroit.
 */
export function Contribuer({ engine, open, onClose }) {
  // Petit écran : la fenêtre prend tout l'écran.
  const { compact } = useViewport();
  // Compte du contributeur.
  const compte = useCompte({ open });
  // Liste des placements.
  const feed = useContributions({ open, token: compte.token });

  // Publication : l'en-tête lu est traduit en charge d'API.
  const publish = ({ info, title, note }) => feed.publish({ filename: info.filename, title, note, header: headerPayload(info) });

  // « Voir sur le globe » : la caméra descend à la verticale du relevé.
  const show = (item) => {
    // Moteur présent et calage utilisable.
    if (!engine || !Number.isFinite(item?.anchor?.lat)) return;
    // Altitude d'arrivée : de quoi voir toute l'emprise.
    const altitudeM = Math.max(600, Math.max(item.sizeMeters?.[0] || 0, item.sizeMeters?.[1] || 0) * 1.8);
    // Descente à la verticale du relevé.
    engine.goTo({ name: item.title, lon: item.anchor.lon, lat: item.anchor.lat, altitudeM, fly: true });
    // La fenêtre se ferme pour laisser voir le globe.
    onClose?.();
  // Fin de show.
  };

  // Début du rendu.
  return (
    // Le calque reste monté quand la fenêtre est fermée : les emprises restent visibles sur le globe.
    <>
      {/* Les emprises publiées, dessinées sur la Terre. */}
      <ContributionLayer engine={engine} items={feed.items} />
      {/* La fenêtre. */}
      <Dialog
        open={open}
        onClose={onClose}
        fullScreen={compact}
        fullWidth
        maxWidth="md"
        aria-label="Contribuer : placements LiDAR"
        slotProps={{ paper: { sx: { display: 'flex', flexDirection: 'column', maxHeight: compact ? 'none' : 'min(88vh, 900px)' } } }}
      >
        {/* En-tête de la fenêtre. */}
        <PanelHeader kicker="LiDAR HD de l’IGN" title="Contribuer" onClose={onClose} />
        {/* Corps défilant. */}
        <Box sx={{ overflowY: 'auto', overscrollBehavior: 'contain', p: 2, display: 'grid', gap: 2, minHeight: 0 }}>
          {/* Le compte : inscription, connexion, ou pseudonyme connecté. */}
          <CompteBox compte={compte} />
          {/* Sans base de données, le serveur avertit que rien n'est conservé. */}
          {!feed.persistent && (
            // L'avertissement.
            <Alert severity="warning">Ce serveur n’a pas de base de données : les comptes et les placements sont perdus à son redémarrage.</Alert>
          )}
          {/* Connecté : le dépôt d'un fichier. */}
          {compte.session && (
            // Le bloc de publication.
            <>
              {/* Séparateur. */}
              <Divider />
              {/* Choix du fichier et publication. */}
              <LazAnalyse onPublish={publish} disabled={feed.loading} />
            {/* Fin du bloc. */}
            </>
          )}
          {/* Séparateur avant la liste. */}
          <Divider />
          {/* Ordre de la liste. */}
          <Tabs
            value={feed.sort}
            onChange={(_, value) => feed.setSort(value)}
            variant="scrollable"
            scrollButtons={false}
            aria-label="Ordre des placements"
            sx={{ minHeight: 0 }}
          >
            {/* Un onglet par ordre. */}
            {SORTS.map(([value, label]) => <Tab key={value} value={value} label={label} sx={{ minHeight: 0, py: 1 }} />)}
          {/* Fin des onglets. */}
          </Tabs>
          {/* Message d'erreur de la liste ou d'un vote. */}
          {feed.error && <Alert severity="error" role="alert">{feed.error}</Alert>}
          {/* La liste des placements, ou un mot quand elle est vide. */}
          {feed.items.length === 0 ? (
            // Liste vide : en cours de lecture, ou rien à montrer.
            <Typography variant="body2" color="text.secondary">
              {/* Le texte. */}
              {feed.loading ? 'Lecture des placements…' : 'Aucun placement publié pour l’instant. Déposez une dalle LiDAR HD pour ouvrir la liste.'}
            {/* Fin du texte. */}
            </Typography>
          ) : (
            // Les cartes des placements.
            <Box sx={{ display: 'grid', gap: 1.5 }}>
              {/* Une carte par placement. */}
              {feed.items.map((item) => (
                // La carte.
                <PlacementCard
                  key={item.id}
                  item={item}
                  canVote={Boolean(compte.session)}
                  isAuthor={compte.session?.account?.id === item.author?.id}
                  onVote={(value) => feed.vote(item, value)}
                  onRemove={feed.remove}
                  onShow={show}
                />
              // Fin des cartes.
              ))}
            {/* Fin de la liste. */}
            </Box>
          )}
          {/* Ce que le serveur garde, et ce qu'il ne garde pas. */}
          <Typography variant="caption" color="text.secondary">
            {/* La note de bas de fenêtre. */}
            Seul l’en-tête du fichier est lu, dans votre navigateur : son emprise, son nombre de points et son système de
            coordonnées. Le relevé lui-même ne quitte pas votre appareil. Un placement décrit donc où se trouve un relevé,
            et les votes disent s’il est au bon endroit. Les dalles LiDAR HD de l’IGN (Lambert-93, EPSG:2154) sont placées
            automatiquement ; les relevés en degrés WGS84 aussi. Un pseudonyme peut être créé par n’importe qui : le vote
            ne prouve rien, il signale.
          {/* Fin de la note. */}
          </Typography>
        {/* Fin du corps. */}
        </Box>
      {/* Fin de la fenêtre. */}
      </Dialog>
    {/* Fin du rendu. */}
    </>
  // Fin du retour.
  );
// Fin de Contribuer.
}
