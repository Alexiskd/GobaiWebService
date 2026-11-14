// Importe de React les crochets useCallback, useEffect, useRef, useState et useSyncExternalStore.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
// Importe de MUI Box, ButtonBase (bouton nu), Divider, Paper, Slider (réglette) et Tooltip.
import { Box, ButtonBase, Divider, Paper, Slider, Tooltip } from '@mui/material';
// Importe useHud, qui lit une valeur du magasin du HUD.
import { useHud } from '@/moteur/engine/hudStore';
// Importe le crochet du pilotage en penchant le téléphone.
import { useDeviceCompass } from '@/composante/hooks/useDeviceCompass';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/composante/hooks/useViewport';
// Importe la hauteur des étages du bas, celle du bandeau titre, la position du pavé de zoom et edge.
import { BOTTOM_STACK, TITLE_H, ZOOM_BOTTOM, edge } from '@/composante/theme/layout';
// Importe safe, qui donne une marge de sécurité de l'écran.
import { safe } from '@/composante/theme/mediaQueries';
// Importe le composant Navball.
import Navball from '../Navball';
// Importe C, la palette de la navball.
import { C } from '../Navball/tokens';
// Importe plusieurs éléments du module tiltSensitivity (début de la liste).
import {
  // Les bornes et le pas de la sensibilité, puis le lecteur, le réglage et l'abonnement de la sensibilité du zoom.
  SENSITIVITY_MAX, SENSITIVITY_MIN, SENSITIVITY_STEP, getTiltZoomSensitivity, setTiltZoomSensitivity, subscribeTiltZoomSensitivity,
// Fin de la liste ; module d'origine.
} from '@/moteur/lib/tiltSensitivity';
// Importe le calcul de l'attitude à partir d'une base.
import { attitudeFromBasis } from './attitude';
// Importe les icônes : cadenas, pilotage au téléphone et « Ma position ».
import { ArrowUpwardIcon, FlightTakeoffIcon, LockIcon, MyLocationIcon } from '../../ui/icons';

// Taille du dessin d'origine de la navball, en pixels.
const DESIGN = 420;
// Largeur de la colonne.
const WIDTH = 48;          // largeur du bouton + du zoom
// Hauteur d'un bouton sous la boule.
const LOCK_H = 28;         // bouton N / cadenas sous la boule
// Hauteur du panneau : la boule, un filet de 1 px et le bouton du verrou.
const PANEL_H = WIDTH + 1 + LOCK_H;
// Demi-hauteur du pavé de zoom.
const ZOOM_HALF = 48.5;    // demi-hauteur du ZoomPad (48 + 1 + 48)
// Écart entre le pavé de zoom et la navball.
const GAP = 8;
// Ta Navball telle quelle (canevas 388 px + marge de 16 px = 420 px), réduite pour tenir entière dans la case.
// Facteur de réduction du dessin d'origine.
const BALL_SCALE = WIDTH / DESIGN;
// Décalage du dessin dans sa case : aucun.
const BALL_OFFSET = 0;
// Vitesse de rotation de la boule, en radians par seconde.
const SPIN_RAD_PER_S = (2 * Math.PI) / 20; // boule toujours en mouvement : un tour en 20 s

/**
 * NavballPilote — composante isolée : la navball (mode pilotage) de l'app Navball, réduite à la boule (48 px) +
 * le bouton N / cadenas, posée au-dessus des boutons +/−.
 * Navball en mode pilotage, branchée sur la caméra 3D dans les deux sens :
 *  - elle affiche en direct le cap, le tangage (inclinaison) et le roulis de la caméra ;
 *  - glisser horizontalement tourne la caméra (cap), verticalement l'incline (tangage), la molette règle le cap.
 * Le bouton N / cadenas bloque ou débloque l'orientation nord/sud ; tourner le cap à la main débloque.
 * Sur téléphone, les deux boutons du bas (flèche vers le haut : zoom seul ; décollage : zoom et déplacement
 * latéral) pilotent la caméra en penchant l'appareil, nord verrouillé.
 * Tout en bas de la colonne, l'icône « Ma position » : elle a quitté la barre d'outils pour se poser sous la boule.
 * Le clavier W/S A/D Q/E de la navball est désactivé ici : S ouvre déjà les sources de l'application.
 */
// Déclare et exporte le composant NavballPilote : HUD, moteur, verrou (faux par défaut), recalibrage, arrêt de la rotation automatique et messages.
export function NavballPilote({ hud, engine, locked = false, onRecalibrate, onStopAuto, push, positionLive, positionWaiting, onMyPosition }) {
  // Lit le mode compact.
  const { compact } = useViewport();
  // Lit les données de la boussole dans le HUD.
  const compass = useHud(hud, (s) => s.compass);
  // Référence : l'état courant du verrou.
  const lockedRef = useRef(locked);
  // Mise à jour à chaque rendu.
  lockedRef.current = locked;
  // Téléphone : pilotage en penchant l'appareil (boutons ⬆️ et 🚀 sous le verrou nord).
  // Pilotage en penchant le téléphone.
  const pilot = useDeviceCompass({ engine, push });
  // Référence : le pilotage courant.
  const pilotRef = useRef(pilot);
  // Mise à jour à chaque rendu.
  pilotRef.current = pilot;
  // Verrou relâché d'ailleurs (autre commande) : le pilotage au téléphone s'arrête avec lui.
  // Référence : l'état du verrou au rendu précédent.
  const wasLocked = useRef(locked);
  // Effet relancé quand le verrou change.
  useEffect(() => {
    // Si le verrou vient d'être relâché pendant un pilotage au téléphone, arrête ce pilotage.
    if (wasLocked.current && !locked && pilotRef.current.mode) pilotRef.current.stop();
    // Mémorise l'état du verrou.
    wasLocked.current = locked;
  // Fin de l'effet ; dépendance : le verrou.
  }, [locked]);

  // Orientation lue à chaque image ; la Navball (composante d'affichage) se redessine quand elle change.
  // État : l'attitude affichée (cap 0, tangage -90, roulis 0 au départ).
  const [attitude, setAttitude] = useState({ h: 0, p: -90, r: 0 });
  // Effet qui lit l'orientation à chaque image.
  useEffect(() => {
    // Sans moteur, rien à faire.
    if (!engine) return undefined;
    // Identifiant de la prochaine image d'animation.
    let raf = 0;
    // Dernière attitude affichée, inconnue au départ.
    let last = { h: NaN, p: NaN, r: NaN };
    // Angle de rotation de la boule et instant de l'image précédente.
    let spin = 0, prev = performance.now();
    // Rotation animée en continu autour de l'axe Nord-Sud de la boule (un tour en 20 s), ajoutée à la vue du globe.
    // turn : fait tourner un vecteur d'un angle donné autour de son troisième axe.
    const turn = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a), v[2]];
    // Déclare tick, appelée à chaque image.
    const tick = (now = performance.now()) => {
      // Programme l'image suivante.
      raf = requestAnimationFrame(tick);
      // Fait avancer l'angle selon le temps écoulé, ramené à un tour.
      spin = (spin + ((now - prev) / 1000) * SPIN_RAD_PER_S) % (2 * Math.PI);
      // Mémorise l'instant de cette image.
      prev = now;
      // Boule = globe de l'astre ciblé vu par la caméra : elle tourne avec l'astre et quand la caméra se déplace.
      // Demande au moteur la vue du globe, s'il la fournit.
      const view = engine.globeView?.();
      // Sans vue, rien à faire.
      if (!view) return;
      // Calcule l'attitude à partir des deux axes de la vue, tournés de l'angle de rotation.
      const a = attitudeFromBasis({ f: turn(view.f, spin), r: turn(view.r, spin) });
      // Comparaison écrite pour que NaN (première image) compte comme un changement.
      // Si l'un des trois angles a changé de plus de 0,05 degré.
      if (!(Math.abs(a.h - last.h) <= 0.05 && Math.abs(a.p - last.p) <= 0.05 && Math.abs(a.r - last.r) <= 0.05)) {
        // Mémorise la nouvelle attitude.
        last = a;
        // La met dans l'état : la navball se redessine.
        setAttitude(a);
      // Fin du cas.
      }
    // Fin de tick.
    };
    // Lance la boucle.
    tick();
    // Nettoyage : arrête la boucle.
    return () => cancelAnimationFrame(raf);
  // Fin de l'effet ; dépendance : le moteur.
  }, [engine]);

  // onPilot : applique un changement de cap (dh) et de tangage (dp) ; début de la fonction mémorisée.
  const onPilot = useCallback(({ dh = 0, dp = 0 }) => {
    // Sans moteur, rien à faire.
    if (!engine) return;
    // Arrête la rotation automatique.
    onStopAuto?.();
    // Si le cap change alors que le nord est verrouillé, relâche le verrou.
    if (dh && lockedRef.current) onRecalibrate?.(); // tourner le cap à la main libère le verrou nord
    // Si le cap change pendant un pilotage au téléphone, arrête ce pilotage.
    if (dh && pilotRef.current.mode) pilotRef.current.stop(); // … et reprend la main sur le téléphone
    // Transmet le changement au moteur.
    engine.pilot({ dh, dp });
  // Fin de onPilot ; dépendances : le moteur et les deux rappels.
  }, [engine, onRecalibrate, onStopAuto]);

  // Pilotage au glisser sur la boule : horizontal = cap, vertical = inclinaison ; molette = cap.
  // Référence : la position du pointeur pendant le glisser, null sinon.
  const drag = useRef(null);
  // Référence vers la case de la boule.
  const ballRef = useRef(null);
  // Déclare onPointerDown : début du glisser.
  const onPointerDown = (e) => {
    // L'appui ne remonte pas aux éléments parents.
    e.stopPropagation();
    // Mémorise la position de départ.
    drag.current = { x: e.clientX, y: e.clientY };
    // Capture le pointeur.
    e.currentTarget.setPointerCapture(e.pointerId);
  // Fin de onPointerDown.
  };
  // Déclare onPointerMove : glisser en cours.
  const onPointerMove = (e) => {
    // Sans glisser en cours, rien à faire.
    if (!drag.current) return;
    // Déplacement horizontal et vertical depuis la dernière position.
    const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
    // Mémorise la nouvelle position.
    drag.current = { x: e.clientX, y: e.clientY };
    // Nombre de degrés par pixel.
    const k = (180 / (WIDTH * 0.68)) * 0.6; // degrés par pixel, comme le pilotage de l'app Navball
    // Horizontal : change le cap ; vertical : change le tangage.
    onPilot({ dh: -dx * k, dp: dy * k });
  // Fin de onPointerMove.
  };
  // onPointerUp : fin du glisser.
  const onPointerUp = () => { drag.current = null; };
  // Effet qui pose l'écouteur de molette.
  useEffect(() => {
    // Récupère la case de la boule.
    const el = ballRef.current;
    // Sans case, rien à faire.
    if (!el) return undefined;
    // wheel : bloque le défilement de la page et change le cap de 3 degrés, dans le sens de la molette.
    const wheel = (e) => { e.preventDefault(); e.stopPropagation(); onPilot({ dh: Math.sign(e.deltaY) * 3 }); };
    // Écouteur non passif, pour pouvoir bloquer le défilement.
    el.addEventListener('wheel', wheel, { passive: false });
    // Nettoyage : retire l'écouteur.
    return () => el.removeEventListener('wheel', wheel);
  // Fin de l'effet ; dépendance : onPilot.
  }, [onPilot]);

  // Lit la sensibilité du zoom par inclinaison et s'y abonne.
  const zoomSensitivity = useSyncExternalStore(subscribeTiltZoomSensitivity, getTiltZoomSensitivity, getTiltZoomSensitivity);

  // Sans moteur, rien n'est affiché.
  if (!engine) return null;
  // Hauteur du panneau : deux boutons de plus si le pilotage au téléphone est disponible, un de plus avec « Ma position ».
  const panelH = PANEL_H + (pilot.available ? 2 * (1 + LOCK_H) : 0) + (onMyPosition ? 1 + LOCK_H : 0);
  // Infobulle de « Ma position » : pendant l'attente, pendant le suivi, ou au repos.
  const positionHint = positionWaiting
    // Attente de la géolocalisation.
    ? 'Recherche de votre position…'
    // Suivi en direct, ou proposition de l'activer.
    : positionLive ? 'Zoomer sur ma position (suivie en direct) · arrêter le suivi' : 'Zoomer sur ma position et la suivre en direct';
  // Quatre états seulement : rien, 🔒 seul, ⬆️ + 🔒, 🚀 + 🔒. Jamais ⬆️ et 🚀 ensemble, jamais l'un des deux sans 🔒.
  // Infobulle du bouton ⬆️ : si ce mode est actif…
  const arrowHint = pilot.mode === 'arrow'
    // … ce qu'il fait et comment l'arrêter…
    ? 'Téléphone aux commandes, nord verrouillé : avant/arrière pour zoomer et dézoomer, rien d’autre · arrêter'
    // … sinon ce qu'il propose.
    : 'Zoomer et dézoomer en penchant le téléphone, sans déplacement (verrouille le nord en haut)';
  // Infobulle du bouton 🚀 : si ce mode est actif…
  const shipHint = pilot.mode === 'ship'
    // … ce qu'il fait et comment l'arrêter…
    ? 'Téléphone aux commandes, nord verrouillé : avant/arrière pour zoomer et dézoomer, droite/gauche pour se déplacer · arrêter'
    // … sinon ce qu'il propose.
    : 'Zoomer en penchant le téléphone et se déplacer à droite ou à gauche (verrouille le nord en haut)';
  // Relâcher le verrou arrête aussi le pilotage au téléphone.
  // onLock : arrête le pilotage au téléphone si le verrou est relâché, puis bascule le verrou.
  const onLock = () => { if (locked && pilot.mode) pilot.stop(); onRecalibrate?.(); };
  // ⬆️ ou 🚀 : un appui sur le mode actif l'arrête (🔒 reste) ; sinon il démarre, remplace l'autre et verrouille le nord.
  // Déclare onMode : appui sur ⬆️ ou 🚀.
  const onMode = async (next) => {
    // Appui sur le mode déjà actif : arrêt.
    if (pilot.mode === next) { pilot.stop(); return; }
    // Arrête la rotation automatique.
    onStopAuto?.();
    // Démarre le mode ; s'il démarre et que le nord n'est pas verrouillé, le verrouille.
    if ((await pilot.start(next)) && !lockedRef.current) onRecalibrate?.();
  // Fin de onMode.
  };
  // Le nord de référence : celui du système solaire ou celui de l'astre.
  const ref = compass?.system ? 'du système' : 'de l’astre';
  // Infobulle du verrou : s'il est actif…
  const lockHint = locked
    // … l'orientation en cours et le moyen de la débloquer…
    ? `Orientation verrouillée : nord ${ref} en haut, sud en bas · débloquer`
    // … sinon ce que le bouton propose.
    : `Bloquer l’orientation nord/sud ${ref}`;

  // Même colonne que les boutons +/− (ZoomPad) : même bord droit, même largeur (48 px), posée juste au-dessus.
  // Placement vertical commun à la navball et à sa réglette de sensibilité.
  // Placement vertical : en mode compact…
  const vertical = compact
    // … centré dans la zone libre entre le bandeau titre et les étages du bas…
    ? { top: `max(calc(${safe('top')} + ${TITLE_H}px), calc(${safe('top')} + ${TITLE_H}px + (100dvh - ${safe('top')} - ${safe('bottom')} - ${TITLE_H + BOTTOM_STACK + panelH}px) / 2))` }
    // … sinon juste au-dessus du pavé de zoom.
    : { bottom: edge('bottom', ZOOM_BOTTOM + 2 * ZOOM_HALF + GAP) };
  // Distance au bord droit : 8 px en mode compact, 14 px sinon.
  const side = compact ? 8 : 14;

  // Début du rendu.
  return (
    // Fragment : regroupe la réglette et la navball.
    <>
    {/* Pilotage en cours : réglette de sensibilité avancer / reculer, à gauche de la navball. */}
    {/* Pendant un pilotage au téléphone (début). */}
    {pilot.mode && (
      // Carte de la réglette (début de la balise).
      <Paper
        // Ombre moyenne.
        elevation={4}
        // Rôle de groupe.
        role="group"
        // Nom pour les lecteurs d'écran.
        aria-label="Sensibilité avancer / reculer"
        // Début du style.
        sx={{
          // Fixée à gauche de la navball, au même niveau vertical.
          position: 'fixed', zIndex: (t) => t.zIndex.hud, right: edge('right', side + WIDTH + 6), ...vertical,
          // Colonne de 40 px, de la hauteur du panneau, contenu centré.
          width: 40, height: panelH, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, py: 0.75,
          // Couleurs de la navball, sans dégradé, gestes tactiles réservés.
          bgcolor: C.bg, color: C.fg, backgroundImage: 'none', touchAction: 'none',
        // Fin du style.
        }}
      // Fin de la balise ouvrante.
      >
        {/* La valeur de la sensibilité, en petit, décorative. */}
        <Box component="span" aria-hidden="true" sx={{ fontSize: 10, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {/* Le signe × suivi de la valeur au format français. */}
          ×{zoomSensitivity.toLocaleString('fr-FR')}
        {/* Fin de la valeur. */}
        </Box>
        {/* La réglette (début de la balise). */}
        <Slider
          // Verticale.
          orientation="vertical"
          // Petite taille.
          size="small"
          // Nom pour les lecteurs d'écran.
          aria-label="Sensibilité avancer / reculer"
          // Valeur courante.
          value={zoomSensitivity}
          // Valeur minimale.
          min={SENSITIVITY_MIN}
          // Valeur maximale.
          max={SENSITIVITY_MAX}
          // Pas.
          step={SENSITIVITY_STEP}
          // Au changement : enregistre la nouvelle sensibilité.
          onChange={(e, v) => setTiltZoomSensitivity(v)}
          // Prend la hauteur restante, en ambre, avec un curseur de 18 px.
          sx={{ flex: 1, minHeight: 0, color: C.amber, '& .MuiSlider-thumb': { width: 18, height: 18 } }}
        // Fin de la réglette.
        />
      {/* Fin de la carte de la réglette. */}
      </Paper>
    // Fin du cas « pilotage ».
    )}
    {/* Carte de la navball (début de la balise). */}
    <Paper
      // Rendue en balise section.
      component="section"
      // Nom pour les lecteurs d'écran.
      aria-label="Navball, pilotage de la caméra"
      // Ombre moyenne.
      elevation={4}
      // Début du style.
      sx={{
        // Fixée au bord droit, au niveau du HUD.
        position: 'fixed', zIndex: (t) => t.zIndex.hud, right: edge('right', side),
        // Zoom : 97 px de haut, en bas à droite au-dessus de la barre d'outils ; la navball se pose 8 px au-dessus.
        // Téléphone : pas de boutons +/−, la navball est centrée dans la zone libre du bord droit, entre le bandeau
        // titre et les étages du bas (tiroir, bande des astres).
        // Le placement vertical calculé plus haut.
        ...vertical,
        // Colonne de 48 px ; ce qui dépasse est masqué.
        width: WIDTH, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        // Couleurs de la navball, sans dégradé.
        bgcolor: C.bg, color: C.fg, backgroundImage: 'none',
      // Fin du style.
      }}
    // Fin de la balise ouvrante.
    >
      {/* Dessin pensé pour un grand canevas : rendu à 420 px puis réduit (le glisser suit la réduction). */}
      {/* La case de la boule (début de la balise). */}
      <Box
        // Référence pour l'écouteur de molette.
        ref={ballRef}
        // Début du glisser.
        onPointerDown={onPointerDown}
        // Glisser en cours.
        onPointerMove={onPointerMove}
        // Fin du glisser.
        onPointerUp={onPointerUp}
        // Glisser annulé.
        onPointerCancel={onPointerUp}
        // Infobulle d'aide.
        title="Glisser : cap (horizontal) et inclinaison (vertical) · molette : cap"
        // Début du style.
        sx={{
          // Carré de 48 px, ce qui dépasse est masqué, curseur en main ouverte, gestes tactiles réservés.
          position: 'relative', width: WIDTH, height: WIDTH, overflow: 'hidden', cursor: 'grab', touchAction: 'none',
          // Pendant l'appui : curseur en main fermée.
          '&:active': { cursor: 'grabbing' },
        // Fin du style.
        }}
      // Fin de la balise ouvrante.
      >
        {/* Navball d'origine (version GitHub), entière, sans effet ajouté. */}
        {/* Le dessin d'origine, réduit depuis son coin supérieur gauche, sans capter les clics. */}
        <Box sx={{ width: DESIGN, transform: `scale(${BALL_SCALE})`, transformOrigin: 'top left', position: 'absolute', top: BALL_OFFSET, left: BALL_OFFSET, pointerEvents: 'none' }}>
          {/* La navball, avec l'attitude courante. */}
          <Navball attitude={attitude} size={DESIGN - 32} />
        {/* Fin du dessin. */}
        </Box>
      {/* Fin de la case de la boule. */}
      </Box>
      {/* Filet de séparation. */}
      <Divider sx={{ borderColor: C.line }} />
      {/* Infobulle du verrou, placée à gauche. */}
      <Tooltip title={lockHint} placement="left">
        {/* Balise span : l'infobulle fonctionne même quand le bouton est désactivé. */}
        <span>
          {/* Le bouton du verrou (début de la balise). */}
          <ButtonBase
            // Nom, état enfoncé, désactivation sans boussole, et action au clic.
            aria-label={lockHint} aria-pressed={locked} disabled={!compass} onClick={onLock}
            // Taille, police et graisse du bouton…
            sx={{ width: WIDTH, height: LOCK_H, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, fontFamily: C.display,
              // … et ses couleurs : ambre s'il est verrouillé, transparent sinon, avec un fond de survol.
              color: locked ? C.bg : C.fg, bgcolor: locked ? C.amber : 'transparent', '&:hover': { bgcolor: locked ? C.amber : 'rgba(255,255,255,.08)' } }}
          // Fin de la balise ouvrante.
          >
            {/* Un cadenas s'il est verrouillé, la lettre N sinon. */}
            {locked ? <LockIcon sx={{ fontSize: 16, display: 'block' }} /> : 'N'}
          {/* Fin du bouton du verrou. */}
          </ButtonBase>
        {/* Fin de la balise span. */}
        </span>
      {/* Fin de l'infobulle. */}
      </Tooltip>
      {/* Si le pilotage au téléphone est disponible : un bouton pour chacun des deux modes (début). */}
      {pilot.available && [['arrow', ArrowUpwardIcon, arrowHint], ['ship', FlightTakeoffIcon, shipHint]].map(([id, Icon, hint]) => {
        // Ce mode est-il actif ?
        const on = pilot.mode === id;
        // Début du rendu du bouton.
        return (
          // Conteneur du bouton.
          <Box key={id}>
            {/* Filet de séparation. */}
            <Divider sx={{ borderColor: C.line }} />
            {/* Le bouton du mode (début de la balise). */}
            <ButtonBase
              // Nom, infobulle, état enfoncé, et action au clic.
              aria-label={hint} title={hint} aria-pressed={on} onClick={() => onMode(id)}
              // Taille du bouton…
              sx={{ width: WIDTH, height: LOCK_H, display: 'grid', placeItems: 'center', fontSize: 14, lineHeight: 1,
                // … et ses couleurs : ambre s'il est actif, transparent sinon, avec un fond de survol.
                bgcolor: on ? C.amber : 'transparent', '&:hover': { bgcolor: on ? C.amber : 'rgba(255,255,255,.08)' } }}
            // Fin de la balise ouvrante.
            >
              {/* L'icône du mode. */}
              <Icon sx={{ fontSize: 16, display: 'block' }} />
            {/* Fin du bouton du mode. */}
            </ButtonBase>
          {/* Fin du conteneur. */}
          </Box>
        // Fin du rendu du bouton.
        );
      // Fin des boutons de mode.
      })}
      {/* « Ma position » (si le rappel existe) : dernière case de la colonne, en icône (début). */}
      {onMyPosition && (
        // Conteneur du bouton.
        <Box>
          {/* Filet de séparation. */}
          <Divider sx={{ borderColor: C.line }} />
          {/* Infobulle, placée à gauche. */}
          <Tooltip title={positionHint} placement="left">
            {/* Balise span : l'infobulle fonctionne même quand le bouton est désactivé. */}
            <span>
              {/* Le bouton (début de la balise). */}
              <ButtonBase
                // Nom, état enfoncé pendant le suivi, coupé pendant l'attente, et action au clic.
                aria-label="Ma position" aria-pressed={Boolean(positionLive)} disabled={Boolean(positionWaiting)} onClick={onMyPosition}
                // Taille du bouton et taille de l'icône…
                sx={{ width: WIDTH, height: LOCK_H, display: 'grid', placeItems: 'center', fontSize: 17, lineHeight: 1,
                  // … ses couleurs : ambre pendant le suivi, transparent sinon, avec un fond de survol…
                  color: positionLive ? C.bg : C.fg, bgcolor: positionLive ? C.amber : 'transparent',
                  '&:hover': { bgcolor: positionLive ? C.amber : 'rgba(255,255,255,.08)' },
                  // … et estompé pendant l'attente.
                  '&.Mui-disabled': { color: C.fg, opacity: 0.45 } }}
              // Fin de la balise ouvrante.
              >
                {/* L'icône de position, décorative (le nom est porté par aria-label). */}
                <MyLocationIcon sx={{ fontSize: 17, display: 'block' }} />
              {/* Fin du bouton. */}
              </ButtonBase>
            {/* Fin de la balise span. */}
            </span>
          {/* Fin de l'infobulle. */}
          </Tooltip>
        {/* Fin du conteneur. */}
        </Box>
      // Fin de « Ma position ».
      )}
    {/* Fin de la carte de la navball. */}
    </Paper>
    {/* Fin du fragment. */}
    </>
  // Fin du rendu.
  );
// Fin de NavballPilote.
}
