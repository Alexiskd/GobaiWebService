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
// Importe les limites des zones du téléphone.
import { HUD_BOTTOM, HUD_TOP } from '@/composante/theme/layout';
// Importe la lecture et le suivi des zones mesurées.
import { getZones, subscribeZones } from '@/composante/hooks/useZones';
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
// Positions des coins sur téléphone : 5 px sous la zone du titre, 5 px au-dessus du dock.
const POSITION_COMPACT = {
  // Nord-ouest.
  nw: { top: `calc(${HUD_TOP} + 5px)`, left: `calc(${safe('left')} + 5px)` },
  // Nord-est.
  ne: { top: `calc(${HUD_TOP} + 5px)`, right: `calc(${safe('right')} + 5px)`, flexDirection: 'row-reverse' },
  // Sud-ouest.
  sw: { bottom: `calc(${HUD_BOTTOM} + 5px)`, left: `calc(${safe('left')} + 5px)` },
  // Sud-est.
  se: { bottom: `calc(${HUD_BOTTOM} + 5px)`, right: `calc(${safe('right')} + 5px)`, flexDirection: 'row-reverse' },
// Fin des positions.
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
    // La position du coin : sur téléphone, contre les zones du titre et du dock ; sinon contre les bords.
    ...(compact ? POSITION_COMPACT : POSITION)[corner.id],
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

/**
 * Marges du cadre (et coins que le moteur calcule) : sur téléphone, les zones mesurées du haut et du bas (zone du
 * titre, dock), suivies à chaque changement ; sur ordinateur, aucune.
 */
// Déclare le crochet useBottomInset : reçoit le moteur et le mode compact.
function useBottomInset(engine, compact) {
  // Effet qui suit les marges du cadre.
  useEffect(() => {
    // Sans moteur, rien à faire.
    if (!engine) return undefined;
    // Déclare apply, qui applique les marges des zones.
    const apply = (z) => {
      // Téléphone : la zone du titre en haut, le dock en bas ; ordinateur : rien.
      const top = compact ? z.top : 0, bottom = compact ? z.bottom : 0;
      // Variables CSS des indicateurs de l'ordinateur (nulles : ils sont dans la zone du titre sur téléphone).
      document.documentElement.style.setProperty('--gps-bottom', '0px');
      // Même chose pour le haut.
      document.documentElement.style.setProperty('--gps-top', '0px');
      // Transmet les marges au moteur, s'il gère cette commande.
      engine.setGpsInsets?.({ bottom: bottom ? bottom + 5 : 0, top: top ? top + 5 : 0 });
    // Fin de apply.
    };
    // Première application.
    apply(getZones());
    // Puis à chaque changement des zones ; nettoyage : désabonnement.
    return subscribeZones(apply);
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
              bottom: compact ? `calc(${HUD_BOTTOM} + 44px)` : `calc(${BOTTOM} + 74px)`, left: `calc(${safe('left')} + 5px)`,
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
