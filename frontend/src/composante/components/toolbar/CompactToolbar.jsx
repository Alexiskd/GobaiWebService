// Importe les hooks useRef et useState de React.
import { useRef, useState } from 'react';
// Importe les composants MUI de la boîte, du bouton nu, du panneau et du texte.
import { Box, ButtonBase, Paper, Typography } from '@mui/material';
// Importe useHud, la lecture de l'état du moteur.
import { useHud } from '@/moteur/engine/hudStore';
// Importe iconNode, le dessin d'une icône.
import { iconNode } from './iconNode';
// Importe les icônes des quatre espaces.
import { ExploreIcon, NavigationIcon, StorageIcon, MenuIcon } from '../ui/icons';
// Importe FeuilleActions, la feuille qui monte du bas de l'écran.
import { FeuilleActions } from '../ui/FeuilleActions';
// Importe safe, la marge de sécurité de l'écran.
import { safe } from '@/composante/theme/mediaQueries';

// Les quatre espaces de la navigation (début).
const TABS = [
  // Explorer.
  { id: 'explore', label: 'Explorer', icon: ExploreIcon, title: 'Explorer' },
  // Orbite : le pilotage orbital.
  { id: 'camera', label: 'Orbite', icon: NavigationIcon, title: 'Pilotage orbital' },
  // L'espace « Couches » a disparu : son unique bouton (Informations) est passé dans le panneau des caractéristiques,
  // qui s'ouvre d'un appui sur l'en-tête de son tiroir.
  // Données : les données et les sources.
  { id: 'data', label: 'Données', icon: StorageIcon, title: 'Données et sources' },
  // Menu.
  { id: 'help', label: 'Menu', icon: MenuIcon, title: 'Menu' },
// Fin des espaces.
];

// Titre de la feuille de chaque espace (début).
const TITLES = {
  // Explorer.
  explore: 'Explorer l’Univers',
  // Orbite.
  camera: 'Orbite et pilotage',
  // Données.
  data: 'Données scientifiques',
  // Menu.
  help: 'Menu et paramètres',
// Fin des titres.
};

// Composant ActionTile : la tuile d'une action, avec la fonction de choix et la référence d'ancrage (début).
function ActionTile({ action, onPick, anchorRef }) {
  // État enfoncé : indéfini pour une action sans bascule, sinon un booléen.
  const pressed = action.pressed === undefined ? undefined : Boolean(action.pressed);
  // Rendu (début).
  return (
    // Bouton (début).
    <ButtonBase
      // Nom pour les lecteurs d'écran.
      aria-label={action.label}
      // État enfoncé, pour les lecteurs d'écran.
      aria-pressed={pressed}
      // Coupé si l'action l'est.
      disabled={action.disabled}
      // Marque les actions sans son.
      data-no-sound={action.noSound ? '' : undefined}
      // Au clic (début) :
      onClick={() => {
        // lance l'action, ancrée sur la barre,
        action.onClick?.({ currentTarget: anchorRef.current });
        // puis referme la feuille.
        onPick();
      // Fin du clic.
      }}
      // Style (début) :
      sx={{
        // en colonne, centré, aligné en haut ;
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
        // espacement, taille minimale, marge intérieure et coins arrondis ;
        gap: 0.75, minWidth: 0, minHeight: 82, p: 1, borderRadius: 3,
        // couleur du texte ; fond marqué quand l'action est enfoncée ;
        color: 'text.primary', bgcolor: pressed ? 'action.selected' : 'transparent',
        // fond au toucher ;
        '&:active': { bgcolor: 'action.hover' },
        // estompé quand il est coupé.
        '&.Mui-disabled': { opacity: 0.4 },
      // Fin du style.
      }}
    // Fin des réglages du bouton.
    >
      {/* Pastille de l'icône (début) : */}
      <Box sx={{
        // carré de 48 px, contenu centré, coins arrondis ;
        width: 48, height: 48, display: 'grid', placeItems: 'center', borderRadius: '17px',
        // fond de la couleur principale quand l'action est enfoncée ;
        bgcolor: pressed ? 'primary.main' : 'action.hover',
        // couleur de l'icône assortie ;
        color: pressed ? 'primary.contrastText' : 'text.primary',
        // taille de 22 px.
        fontSize: 22,
      // Fin du style de la pastille.
      }}>
        {/* L'icône de l'action. */}
        {iconNode(action.icon, 22)}
      {/* Fin de la pastille. */}
      </Box>
      {/* Libellé (début) : */}
      <Typography component="span" sx={{
        // petit texte, gras quand l'action est enfoncée ;
        fontSize: 11, lineHeight: 1.2, fontWeight: pressed ? 700 : 500,
        // centré, coupé où il faut ;
        textAlign: 'center', maxWidth: '100%', overflowWrap: 'anywhere',
        // deux lignes au plus.
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      // Fin du style du libellé.
      }}>
        {/* Le libellé court, sinon le libellé. */}
        {action.short || action.label}
      {/* Fin du libellé. */}
      </Typography>
    {/* Fin du bouton. */}
    </ButtonBase>
  // Fin du rendu.
  );
// Fin de ActionTile.
}

// Composant PerformancePanel : les mesures du moteur en direct (début).
function PerformancePanel({ hud }) {
  // Images par seconde.
  const fps = useHud(hud, (s) => s.fps ?? 0);
  // Mesures de performance.
  const perf = useHud(hud, (s) => s.perf ?? null);
  // metric : met un nombre en forme, une décimale au plus ; un tiret sans valeur.
  const metric = (value) => value == null ? '—' : Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  // Lignes du tableau (début).
  const rows = [
    // Images par seconde.
    { label: 'FPS', value: fps ? String(fps) : 'Mesure en cours', detail: 'Images par seconde' },
    // Temps de calcul du moteur par image, et sa part du temps d'une image.
    { label: 'CPU', value: perf ? `${metric(perf.cpuMs)} ms` : '—', detail: perf ? `${metric(perf.cpuPct)} % du temps image` : 'Calcul moteur / image' },
    // Temps de la carte graphique, quand le navigateur le mesure.
    { label: 'GPU', value: perf?.gpuMs != null ? `${metric(perf.gpuMs)} ms` : 'Non mesurable', detail: perf?.gpuPct != null ? `${metric(perf.gpuPct)} % du temps image` : 'Selon le navigateur' },
    // Appels de rendu et triangles.
    { label: 'Dessins', value: perf ? metric(perf.calls) : '—', detail: perf ? `${metric(perf.triangles)} triangles` : 'Appels de rendu' },
    // Mémoire JavaScript, textures et maillages.
    { label: 'Mémoire', value: perf?.heapMb != null ? `${metric(perf.heapMb)} Mo JS` : 'Non exposée', detail: perf ? `${metric(perf.textures)} textures · ${metric(perf.geometries)} maillages` : 'Textures et géométries' },
  // Fin des lignes.
  ];
  // Rendu (début).
  return (
    // Panneau.
    <Paper elevation={0} sx={{ mt: 1.5, p: 1.5, borderRadius: 3, bgcolor: 'rgba(85, 130, 190, .10)', border: 1, borderColor: 'divider' }}>
      {/* Ligne de titre (début). */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
        {/* Titre « Performances en direct ». */}
        <Typography sx={{ fontSize: 13, fontWeight: 800 }}>Performances en direct</Typography>
        {/* Mention « Moteur 3D ». */}
        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>Moteur 3D</Typography>
      {/* Fin de la ligne de titre. */}
      </Box>
      {/* Grille de deux colonnes (début). */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
        {/* Pour chaque ligne (début) : */}
        {rows.map((row) => (
          // sa case (début),
          <Box key={row.label} sx={{ minWidth: 0, p: 1, borderRadius: 2, bgcolor: 'background.paper' }}>
            {/* son libellé, */}
            <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 700 }}>{row.label}</Typography>
            {/* sa valeur, */}
            <Typography sx={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{row.value}</Typography>
            {/* son détail. */}
            <Typography sx={{ fontSize: 9, lineHeight: 1.3, color: 'text.secondary' }}>{row.detail}</Typography>
          {/* Fin de la case. */}
          </Box>
        // Fin de la boucle.
        ))}
      {/* Fin de la grille. */}
      </Box>
      {/* Note (début). */}
      <Typography sx={{ mt: 1, fontSize: 10, lineHeight: 1.4, color: 'text.secondary' }}>
        {/* Le texte : ce que mesurent les valeurs CPU et GPU. */}
        CPU = temps de calcul du moteur par image, pas le pourcentage global du processeur. La mesure GPU dépend du navigateur.
      {/* Fin de la note. */}
      </Typography>
    {/* Fin du panneau. */}
    </Paper>
  // Fin du rendu.
  );
// Fin de PerformancePanel.
}

/** Navigation mobile en quatre espaces ; les actions existantes restent les mêmes. */
// Déclare et exporte le composant CompactToolbar, avec les actions et l'état du moteur (début).
export function CompactToolbar({ actions, hud }) {
  // État : l'espace ouvert, aucun au départ.
  const [active, setActive] = useState(null);
  // État : le panneau des performances, fermé au départ.
  const [performanceOpen, setPerformanceOpen] = useState(false);
  // Référence de la barre, pour ancrer les menus.
  const anchorRef = useRef(null);
  // L'espace ouvert.
  const selected = TABS.find((tab) => tab.id === active);
  // Les actions de cet espace.
  const items = actions.filter((action) => action.group === active);

  // close : referme la feuille.
  const close = () => setActive(null);
  // toggle : ouvre un espace, ou le referme s'il est déjà ouvert.
  const toggle = (id) => setActive((current) => current === id ? null : id);

  // Rendu (début).
  return (
    // Fragment (début).
    <>
      {/* Barre de navigation (début). */}
      <Paper
        // Sa référence.
        ref={anchorRef}
        // Balise nav.
        component="nav"
        // Rôle de navigation.
        role="navigation"
        // Nom pour les lecteurs d'écran.
        aria-label="Navigation principale"
        // Repère pour le reste de l'interface.
        data-hud="mobile-navigation"
        // Ombre portée.
        elevation={8}
        // Style (début) :
        sx={{
          // fixe, au niveau de la barre d'outils ;
          position: 'fixed', zIndex: (theme) => theme.zIndex.toolbar,
          // collée en bas, sur toute la largeur ;
          left: 0, right: 0, bottom: 0,
          // quatre colonnes égales ;
          display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          // marges intérieures ;
          gap: 0, px: 0.75, pt: 0.75,
          // marge du bas : 6 px plus la marge de sécurité de l'écran ;
          pb: 'calc(6px + ' + safe('bottom') + ')',
          // trait du haut et coins arrondis en haut ;
          borderTop: 1, borderColor: 'divider', borderRadius: '18px 18px 0 0',
          // fond sombre presque opaque et texte clair ;
          bgcolor: 'rgba(7, 13, 27, 0.94)', color: '#E7EEFC',
          // flou de l'arrière-plan.
          backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
        // Fin du style.
        }}
      // Fin des réglages de la barre.
      >
        {/* Pour chaque espace (début). */}
        {TABS.map((tab) => {
          // Est-il ouvert ?
          const isActive = active === tab.id;
          // Rendu (début).
          return (
            // Bouton de l'espace (début).
            <ButtonBase
              // Sa clé.
              key={tab.id}
              // Nom pour les lecteurs d'écran.
              aria-label={tab.title}
              // État ouvert, pour les lecteurs d'écran.
              aria-expanded={isActive}
              // Lien avec la feuille, quand elle est ouverte.
              aria-controls={isActive ? 'gobai-mobile-actions' : undefined}
              // Au clic : ouvre ou referme l'espace.
              onClick={() => toggle(tab.id)}
              // Style (début) :
              sx={{
                // taille minimale et marges ;
                minWidth: 0, minHeight: 52, px: 0.25, py: 0.5,
                // en colonne ;
                display: 'flex', flexDirection: 'column', gap: 0.4,
                // coins arrondis ; couleur plus vive quand il est ouvert ;
                borderRadius: 2.5, color: isActive ? '#B9D7FF' : 'rgba(226,235,250,.68)',
                // fond léger quand il est ouvert.
                bgcolor: isActive ? 'rgba(88, 145, 220, .16)' : 'transparent',
              // Fin du style.
              }}
            // Fin des réglages du bouton.
            >
              {/* Son icône. */}
              <Box component="span" aria-hidden="true" sx={{ display: 'flex', fontSize: 21, lineHeight: 1.1 }}>{iconNode(tab.icon, 21)}</Box>
              {/* Son libellé (début). */}
              <Typography component="span" sx={{ fontSize: 10, lineHeight: 1.15, fontWeight: isActive ? 700 : 500 }}>
                {/* Le texte. */}
                {tab.label}
              {/* Fin du libellé. */}
              </Typography>
            {/* Fin du bouton. */}
            </ButtonBase>
          // Fin du rendu.
          );
        // Fin de la boucle.
        })}
      {/* Fin de la barre. */}
      </Paper>

      {/* Feuille des actions : ouverte quand un espace est choisi. */}
      <FeuilleActions open={Boolean(selected)} onClose={close} label={selected?.title || 'Navigation'}>
        {/* Son contenu (début). */}
        <Box id="gobai-mobile-actions" sx={{ pt: 0.25, pb: 1 }}>
          {/* Titre (début). */}
          <Typography component="h2" sx={{ px: 1, pb: 1.5, fontSize: 15, fontWeight: 700, letterSpacing: 0.2 }}>
            {/* Le titre de l'espace. */}
            {selected ? TITLES[selected.id] : ''}
          {/* Fin du titre. */}
          </Typography>
          {/* Dans l'espace « Données » (début). */}
          {selected?.id === 'data' && (
            // Bloc des performances (début).
            <Box sx={{ px: 1, mb: 1 }}>
              {/* Bouton du gestionnaire de performances (début). */}
              <ButtonBase
                // Au clic : ouvre ou referme le panneau.
                onClick={() => setPerformanceOpen((open) => !open)}
                // État ouvert, pour les lecteurs d'écran.
                aria-expanded={performanceOpen}
                // Style (début) :
                sx={{
                  // sur toute la largeur, contenu réparti ;
                  width: '100%', display: 'flex', justifyContent: 'space-between', textAlign: 'left',
                  // marges, coins arrondis ; fond marqué quand le panneau est ouvert.
                  p: 1.25, borderRadius: 2.5, bgcolor: performanceOpen ? 'action.selected' : 'action.hover',
                // Fin du style.
                }}
              // Fin des réglages du bouton.
              >
                {/* Textes (début). */}
                <Box>
                  {/* Titre. */}
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Gestionnaire de performances</Typography>
                  {/* Sous-titre. */}
                  <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>FPS · CPU · GPU · mémoire</Typography>
                {/* Fin des textes. */}
                </Box>
                {/* « Masquer » ou « Afficher ». */}
                <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{performanceOpen ? 'Masquer' : 'Afficher'}</Typography>
              {/* Fin du bouton. */}
              </ButtonBase>
              {/* Le panneau, quand il est ouvert. */}
              {performanceOpen && <PerformancePanel hud={hud} />}
            {/* Fin du bloc. */}
            </Box>
          // Fin du cas « Données ».
          )}
          {/* S'il y a des actions (début). */}
          {items.length ? (
            // Grille des tuiles (début).
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 0.5 }}>
              {/* Pour chaque action (début) : */}
              {items.map((action) => (
                // sa tuile.
                <ActionTile key={action.id} action={action} onPick={close} anchorRef={anchorRef} />
              // Fin de la boucle.
              ))}
            {/* Fin de la grille. */}
            </Box>
          // Sinon, hors de l'espace « Données » (début).
          ) : selected?.id !== 'data' ? (
            // Message (début).
            <Typography color="text.secondary" sx={{ px: 1, py: 2, fontSize: 13 }}>
              {/* Le texte : aucune action dans cet espace. */}
              Aucune action disponible dans cet espace pour le moment.
            {/* Fin du message. */}
            </Typography>
          // Sinon : rien.
          ) : null}
        {/* Fin du contenu. */}
        </Box>
      {/* Fin de la feuille. */}
      </FeuilleActions>
    {/* Fin du fragment. */}
    </>
  // Fin du rendu.
  );
// Fin de CompactToolbar.
}
