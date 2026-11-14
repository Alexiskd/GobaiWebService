// Importe useEffect de React.
import { useEffect } from 'react';
// Importe de MUI Box et Paper.
import { Box, Paper } from '@mui/material';
// Importe useHud, qui lit une valeur du magasin du HUD.
import { useHud } from '@/moteur/engine/hudStore';
// Importe les mises en forme de distance, de latitude et de longitude, le nombre de décimales et l'échelle arrondie.
import { formatDistance, formatLat, formatLon, gpsDecimals, niceScale } from '@/moteur/engine/gps';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/composante/hooks/useViewport';
// Importe la hauteur de l'en-tête replié du tiroir.
import { SHEET_HEAD_H } from '@/composante/theme/layout';
// Importe safe, qui donne une marge de sécurité de l'écran.
import { safe } from '@/composante/theme/mediaQueries';
// Importe les icônes des quatre coins et du réticule.
import { MyLocationIcon, NorthEastIcon, NorthWestIcon, SouthEastIcon, SouthWestIcon } from '../ui/icons';

// Cadre GPS de la Terre : coordonnées des quatre coins de la zone visible, centre (réticule), barre d'échelle et
// altitude. Le nombre de décimales suit l'échelle (≈ un pixel à l'écran : 7 décimales ≈ 1 cm à l'échelle de 10 m).
// Sur mobile, le bas du cadre est relevé au-dessus de la bande des astres : les coins affichés restent visibles.

// Icône de chaque coin : nord-ouest, nord-est, sud-ouest, sud-est.
const ARROWS = { nw: NorthWestIcon, ne: NorthEastIcon, sw: SouthWestIcon, se: SouthEastIcon };
// Style des flèches : à la taille du texte de la pastille, alignées sur la ligne.
const ARROW_SX = { fontSize: 'inherit', verticalAlign: '-0.15em' };
// Variable CSS de la marge basse du cadre.
const BOTTOM = 'var(--gps-bottom, 0px)';
// Variable CSS de la marge haute du cadre.
const TOP = 'var(--gps-top, 0px)';
// Position de la pastille de chaque coin (début de l'objet).
const POSITION = {
  // Nord-ouest : en haut à gauche, à 5 px des marges.
  nw: { top: `calc(${TOP} + ${safe('top')} + 5px)`, left: `calc(${safe('left')} + 5px)` },
  // Nord-est : en haut à droite, contenu inversé.
  ne: { top: `calc(${TOP} + ${safe('top')} + 5px)`, right: `calc(${safe('right')} + 5px)`, flexDirection: 'row-reverse' },
  // Sud-ouest : en bas à gauche.
  sw: { bottom: `calc(${BOTTOM} + 5px)`, left: `calc(${safe('left')} + 5px)` },
  // Sud-est : en bas à droite, contenu inversé.
  se: { bottom: `calc(${BOTTOM} + 5px)`, right: `calc(${safe('right')} + 5px)`, flexDirection: 'row-reverse' },
// Fin de l'objet.
};

/** Pastille de coordonnées : police à chasse fixe, chiffres alignés, au-dessus de la scène et sous les panneaux. */
// Déclare le composant Chip : styles, contenu et autres propriétés.
function Chip({ sx, children, ...rest }) {
  // Début du rendu.
  return (
    // Carte de la pastille (début de la balise).
    <Paper
      // Ombre légère.
      elevation={2}
      // Les autres propriétés reçues.
      {...rest}
      // Début du style.
      sx={{
        // Fixée, sans capter les clics, contenu aligné sur la ligne de base.
        position: 'fixed', zIndex: 26, pointerEvents: 'none', display: 'flex', alignItems: 'baseline', gap: '5px',
        // Petites marges, coins arrondis, une seule ligne, chiffres de largeur fixe.
        px: 0.75, py: 0.25, borderRadius: 1, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
        // Police à chasse fixe, petite taille.
        fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace', fontSize: 11.5, lineHeight: 1.35,
        // Symboles en gras, couleur primaire.
        '& b': { fontWeight: 700, color: 'primary.main' },
        // Styles supplémentaires passés par l'appelant.
        ...sx,
      // Fin du style.
      }}
    // Fin de la balise ouvrante.
    >
      {/* Le contenu. */}
      {children}
    {/* Fin de la carte. */}
    </Paper>
  // Fin du rendu.
  );
// Fin de Chip.
}

// Déclare le composant Corner : le coin, le nombre de décimales et le mode compact.
function Corner({ corner, digits, compact }) {
  // Style de la pastille (début de l'objet).
  const sx = {
    // La position du coin.
    ...POSITION[corner.id],
    // En mode compact : sur deux lignes, alignées du côté du coin, en plus petit.
    ...(compact && { flexDirection: 'column', alignItems: corner.id.endsWith('e') ? 'flex-end' : 'flex-start', gap: 0, fontSize: 10.5 }),
  // Fin de l'objet.
  };
  // L'icône du coin : une flèche vers le nord-ouest, le nord-est, le sud-ouest ou le sud-est.
  const Arrow = ARROWS[corner.id];
  // Si le coin tombe hors de l'astre.
  if (corner.lat === null) {
    // Pastille « espace », avec la flèche du coin.
    return <Chip sx={sx} aria-hidden="true"><Arrow sx={ARROW_SX} /><Box component="span" sx={{ color: 'text.secondary' }}>espace</Box></Chip>;
  // Fin du cas.
  }
  // Latitude et longitude mises en forme.
  const lat = formatLat(corner.lat, digits), lon = formatLon(corner.lon, digits);
  // Début du rendu.
  return (
    // La pastille, cachée aux lecteurs d'écran.
    <Chip sx={sx} aria-hidden="true">
      {/* En mode compact (début). */}
      {compact ? (
        // Deux lignes : la flèche et la latitude, puis la longitude.
        <><span><Arrow sx={ARROW_SX} /> {lat}</span><span>{lon}</span></>
      // Sinon (début).
      ) : (
        // Une ligne : la flèche, puis la latitude et la longitude.
        <><Arrow sx={ARROW_SX} /><span>{lat}, {lon}</span></>
      // Fin du choix.
      )}
    {/* Fin de la pastille. */}
    </Chip>
  // Fin du rendu.
  );
// Fin de Corner.
}

/** Mesure la bande des astres du téléphone pour relever le bas du cadre (et informe le moteur des coins à calculer). */
// Déclare le crochet useBottomInset : reçoit le moteur et le mode compact.
function useBottomInset(engine, compact) {
  // Effet qui mesure les marges du cadre.
  useEffect(() => {
    // Sans moteur, rien à faire.
    if (!engine) return undefined;
    // Déclare measure, qui mesure et applique les marges.
    const measure = () => {
      // Marge basse, nulle par défaut.
      let bottom = 0;
      // Marge haute, nulle par défaut.
      let top = 0;
      // En mode compact.
      if (compact) {
        // Bande des astres et en-tête replié du tiroir Informations : le cadre s'arrête au-dessus.
        // Cherche les bandes des astres…
        const tops = [...document.querySelectorAll('[data-hud="nav-strip"]')]
          // … relève le haut de chacune…
          .map((el) => el.getBoundingClientRect().top)
          // … et ne garde que celles de la moitié basse de l'écran.
          .filter((t) => t > window.innerHeight / 2);
        // S'il y en a : la marge basse va du bas de l'écran à la plus haute, plus 4 px.
        if (tops.length) bottom = Math.max(0, window.innerHeight - Math.min(...tops) + 4);
        // Si le tiroir d'informations est présent, ajoute la hauteur de son en-tête.
        if (document.querySelector('[data-hud="sheet"]')) bottom += SHEET_HEAD_H;
        // Bandeau titre : les coins du haut passent dessous (la marge de l'encoche est ajoutée par le style).
        // Mesure le bandeau du titre, s'il existe.
        const title = document.querySelector('[data-hud="title"]')?.getBoundingClientRect();
        // S'il est dans la moitié haute : la marge haute vaut sa hauteur plus 6 px.
        if (title && title.bottom < window.innerHeight / 2) top = Math.max(0, title.bottom - title.top + 6);
      // Fin du mode compact.
      }
      // Écrit la marge basse dans la variable CSS --gps-bottom.
      document.documentElement.style.setProperty('--gps-bottom', `${bottom}px`);
      // Écrit la marge haute dans la variable CSS --gps-top.
      document.documentElement.style.setProperty('--gps-top', `${top}px`);
      // Transmet les marges au moteur, s'il gère cette commande.
      engine.setGpsInsets?.({ bottom: bottom + 5, top: top ? top + 5 : 0 });
    // Fin de measure.
    };
    // Première mesure immédiate.
    measure();
    // Seconde mesure après 300 ms.
    const t = setTimeout(measure, 300); // après la mise en page des barres
    // Nouvelle mesure à chaque redimensionnement.
    window.addEventListener('resize', measure);
    // Nettoyage : annule le délai et retire l'écouteur.
    return () => { clearTimeout(t); window.removeEventListener('resize', measure); };
  // Fin de l'effet ; dépendances : le moteur et le mode compact.
  }, [engine, compact]);
// Fin de useBottomInset.
}

// Déclare et exporte le composant GpsFrame : reçoit le magasin du HUD et le moteur.
export function GpsFrame({ hud, engine }) {
  // Lit le mode compact.
  const { compact } = useViewport();
  // Lit les données GPS de la vue.
  const gps = useHud(hud, (s) => s.gps);
  // Mesure les marges du cadre.
  useBottomInset(engine, compact);
  // Sans données GPS, rien n'est affiché.
  if (!gps) return null;

  // Nombre de décimales selon l'échelle.
  const digits = gpsDecimals(gps.metersPerPixel);
  // Barre d'échelle arrondie, plus courte en mode compact.
  const scale = niceScale(gps.metersPerPixel, compact ? { minPx: 40, maxPx: 90 } : undefined);
  // Table des coins par identifiant.
  const corners = Object.fromEntries(gps.corners.map((c) => [c.id, c]));

  // Début du rendu.
  return (
    // Fragment : regroupe les pastilles.
    <>
      {/* Une pastille par coin connu, dans l'ordre nord-ouest, nord-est, sud-ouest, sud-est. */}
      {['nw', 'ne', 'sw', 'se'].map((id) => corners[id] && <Corner key={id} corner={corners[id]} digits={digits} compact={compact} />)}
      {/* Si le centre de l'écran est sur l'astre (début). */}
      {gps.center && (
        // Fragment : regroupe le réticule et la pastille du centre.
        <>
          {/* Réticule du centre de l'écran. */}
          {/* Le réticule (début de la balise). */}
          <Box
            // Caché aux lecteurs d'écran.
            aria-hidden="true"
            // Début du style.
            sx={{
              // Carré de 18 px centré sur l'écran, sans capter les clics.
              position: 'fixed', zIndex: 23, left: '50%', top: '50%', width: 18, height: 18, m: '-9px 0 0 -9px', pointerEvents: 'none',
              // Une croix blanche : deux traits de 1,5 px.
              background: 'linear-gradient(#fff, #fff) center / 1.5px 100% no-repeat, linear-gradient(#fff, #fff) center / 100% 1.5px no-repeat',
              // Liseré noir pour rester lisible sur fond clair.
              filter: 'drop-shadow(0 0 1px #000) drop-shadow(0 0 1px #000)',
            // Fin du style.
            }}
          // Fin du réticule.
          />
          {/* La pastille du centre (début de la balise). */}
          <Chip
            // Rôle d'état.
            role="status"
            // Non annoncée à chaque changement.
            aria-live="off"
            // Début du style.
            sx={{
              // En bas à gauche, au-dessus de la marge basse.
              bottom: `calc(${BOTTOM} + ${compact ? 44 : 74}px)`, left: `calc(${safe('left')} + 5px)`,
              // Passe à la ligne au besoin, jamais plus large que l'écran, plus petite en mode compact.
              flexWrap: 'wrap', maxWidth: 'calc(100vw - 10px)', ...(compact && { fontSize: 10.5 }),
            // Fin du style.
            }}
          // Fin de la balise ouvrante.
          >
            {/* Le réticule du centre. */}
            <MyLocationIcon sx={{ fontSize: 13 }} />
            {/* Les coordonnées du centre. */}
            <span>{formatLat(gps.center.lat, digits)}, {formatLon(gps.center.lon, digits)}</span>
            {/* Si l'échelle est connue (début). */}
            {scale && (
              // Bloc de l'échelle, avec son infobulle.
              <Box component="span" title="Échelle au centre de l’écran" sx={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                {/* La barre d'échelle : un trait ouvert vers le haut, de la largeur calculée. */}
                <Box component="i" sx={{ display: 'inline-block', height: 6, border: '1.5px solid', borderTop: 0, borderColor: 'text.primary' }} style={{ width: `${Math.round(scale.px)}px` }} />
                {/* La longueur représentée. */}
                {scale.label}
              {/* Fin du bloc de l'échelle. */}
              </Box>
            // Fin du cas.
            )}
            {/* L'altitude, si elle est connue, jamais négative. */}
            {Number.isFinite(gps.altitudeM) && <span>· alt. {formatDistance(Math.max(0, gps.altitudeM))}</span>}
          {/* Fin de la pastille du centre. */}
          </Chip>
        {/* Fin du fragment. */}
        </>
      // Fin du cas « centre ».
      )}
    {/* Fin du fragment. */}
    </>
  // Fin du rendu.
  );
// Fin de GpsFrame.
}
