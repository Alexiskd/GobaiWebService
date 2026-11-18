// Importe de React les crochets useEffect, useRef et useState.
import { useEffect, useRef, useState } from 'react';
// Importe de MUI Box (conteneur) et Typography (texte).
import { Box, Typography } from '@mui/material';
// Importe le badge « En direct ».
import { LiveBadge } from './LiveBadge';
// Importe les calculs de la progression : vitesses maximales de la vidéo, avance de la barre, vitesse de fin, vitesse de lecture.
import { VIDEO_MAX_RATE, VIDEO_MAX_RATE_HANDHELD, advanceProgress, finishRate, videoRate } from '@/moteur/lib/loadingProgress';
// Importe isHandheld, qui dit si l'appareil est un appareil tenu en main.
import { isHandheld } from '@/moteur/engine/powerSaver';
// Importe la coche des étapes franchies.
import { CheckIcon } from './icons';

// Survol simulé de la Lune par Artemis II (vue depuis le hublot d'Orion), version 1 min.
// NASA's Scientific Visualization Studio — https://svs.gsfc.nasa.gov/5536
// Début commun des adresses de la vidéo du survol lunaire (site du SVS de la NASA).
const FLYBY = 'https://svs.gsfc.nasa.gov/vis/a000000/a005500/a005536/a2_flyby_1min_';
/**
 * Connexion lente ou mode « économiseur de données » : pas de vidéo, le fond fixe aux couleurs de l'app reste seul et
 * toute la bande passante va à l'app. Petit écran : version légère (360p). Sinon 720p.
 */
// Déclare flybyVideo, qui choisit la vidéo à lire, ou aucune.
function flybyVideo() {
  // Lit les informations de connexion du navigateur, si elles existent.
  const c = globalThis.navigator?.connection;
  // Connexion lente : économiseur de données activé, ou type de connexion connu et différent de « 4g ».
  const slow = Boolean(c?.saveData) || (c?.effectiveType && c.effectiveType !== '4g');
  // Connexion lente : pas de vidéo.
  if (slow) return null;
  // Petit écran : le plus petit côté de la fenêtre fait 480 px au plus (1280 × 720 supposé hors navigateur).
  const small = Math.min(globalThis.innerWidth || 1280, globalThis.innerHeight || 720) <= 480;
  // Adresse de la vidéo : 360p sur petit écran, 720p sinon.
  return `${FLYBY}${small ? '360p30' : '720p30'}.mp4`;
// Fin de flybyVideo.
}
// Durée du fondu de sortie, en millisecondes.
const FADE_MS = 350;

/** Étapes réelles du démarrage, nommées sous la barre : chacune se coche quand elle est finie. */
// Liste des étapes du démarrage (début du tableau).
const STEPS = [
  // Étape « api » : les données.
  { id: 'api', label: 'Données' },
  // Étape « engine » : le moteur 3D.
  { id: 'engine', label: 'Moteur 3D' },
  // Étape « scene » : la scène.
  { id: 'scene', label: 'Scène' },
// Fin du tableau.
];
/** Étape finie ? `step` = étape en cours ('api' | 'engine' | 'done' | 'error'), `leaving` = barre pleine. */
// Déclare et exporte stepDone, qui dit si une étape est finie.
export function stepDone(id, step, leaving) {
  // Les données sont finies dès que le moteur est en cours ou que tout est fini.
  if (id === 'api') return step === 'engine' || step === 'done';
  // Le moteur est fini quand tout est fini.
  if (id === 'engine') return step === 'done';
  // La scène est finie quand la barre est pleine.
  return Boolean(leaving);
// Fin de stepDone.
}

// Couleurs de l'app : celles des astres (Soleil puis planètes, dans l'ordre de la Navigation),
// le bleu du ∞ du titre, l'ambre des accents et les encres des panneaux.
// Les dix couleurs des astres.
const BODY_COLORS = ['#ffb300', '#b5b5b5', '#e8c27a', '#3d8bff', '#e0553a', '#d9a066', '#f0dc9a', '#7fe3ee', '#4a6bff', '#d8b894'];
// Encre claire du texte.
const INK = '#e8edf8';
// Encre atténuée.
const DIM = '#8b97b3';
// Ambre des accents.
const SUN = '#f0b24a';
// Bleu de la marque.
const BRAND_BLUE = '#0000FF';
// Dégradé horizontal qui parcourt les couleurs des astres.
const SPECTRUM = `linear-gradient(90deg, ${BODY_COLORS.join(', ')})`;

/**
 * Écran de chargement : survol lunaire Artemis II en plein écran, nom de l'app et barre de progression.
 * La vidéo n'est pas lue à vitesse fixe : sa position suit la barre, donc elle avance à la vitesse du chargement.
 * Les pastilles des astres s'allument une à une avec la barre, teinte par teinte.
 * step : 'api' | 'engine' | 'done' | 'error'. `onReveal` est appelé au début du fondu de sortie, `onDone` une fois
 * l'écran estompé.
 */
// Déclare et exporte le composant LoadingScreen : étape en cours, libellé, rappels de fin et de révélation, contenu.
export function LoadingScreen({ step, label, onDone, onReveal, children }) {
  // Référence vers la balise vidéo.
  const videoRef = useRef(null);
  // Référence vers le remplissage de la barre.
  const fillRef = useRef(null);
  // Référence vers le texte du pourcentage.
  const percentRef = useRef(null);
  // Référence vers la rangée de pastilles.
  const orbsRef = useRef(null);
  // Référence : l'étape courante, lisible depuis la boucle d'animation.
  const stepRef = useRef(step);
  // Référence : la progression, de 0 à 1.
  const progressRef = useRef(0);
  // Référence : la vitesse de fin, fixée quand l'étape passe à « done ».
  const doneRateRef = useRef(null);
  // État : l'adresse de la vidéo, choisie une seule fois.
  const [src] = useState(flybyVideo);
  // État : vrai quand la vidéo a une première image.
  const [videoReady, setVideoReady] = useState(false);
  // État : vrai pendant le fondu de sortie.
  const [leaving, setLeaving] = useState(false);
  // Met la référence de l'étape à jour à chaque rendu.
  stepRef.current = step;

  // Effet exécuté une seule fois : la boucle d'animation.
  useEffect(() => {
    // Identifiant de la prochaine image d'animation.
    let raf = 0;
    // Instant de l'image précédente.
    let last = performance.now();
    // Nombre de pastilles allumées (-1 : pas encore calculé).
    let lit = -1;
    // Vitesse maximale de lecture de la vidéo, selon le type d'appareil.
    let maxRate = isHandheld() ? VIDEO_MAX_RATE_HANDHELD : VIDEO_MAX_RATE; // abaissée si le navigateur refuse une lecture aussi rapide
    // Déclare tick, appelée à chaque image.
    const tick = (now) => {
      // Temps écoulé depuis l'image précédente, en secondes, plafonné à 0,1 s.
      const dt = Math.min(0.1, (now - last) / 1000);
      // Mémorise l'instant de cette image.
      last = now;
      // Lit l'étape courante.
      const current = stepRef.current;
      // Tant que tout n'est pas fini, pas de vitesse de fin.
      if (current !== 'done') doneRateRef.current = null;
      // À la fin, calcule une fois la vitesse de fin d'après la progression atteinte.
      else if (doneRateRef.current == null) doneRateRef.current = finishRate(progressRef.current);

      // Fait avancer la progression selon l'étape, le temps écoulé et la vitesse de fin (1 par défaut).
      const p = advanceProgress(progressRef.current, current, dt, doneRateRef.current ?? 1);
      // Mémorise la progression.
      progressRef.current = p;
      // Découvre le remplissage de la barre en rognant sa partie droite.
      if (fillRef.current) fillRef.current.style.clipPath = `inset(0 ${(1 - p) * 100}% 0 0 round 99px)`;
      // Écrit le pourcentage entier.
      if (percentRef.current) percentRef.current.textContent = `${Math.floor(p * 100)} %`;
      // Pastilles : une de plus à chaque dixième de barre.
      // Nombre de pastilles à allumer, proportionnel à la progression (avec une petite marge d'arrondi).
      const count = Math.min(BODY_COLORS.length, Math.floor(p * BODY_COLORS.length + 1e-6));
      // Si ce nombre a changé et que la rangée existe.
      if (count !== lit && orbsRef.current) {
        // Mémorise le nouveau nombre.
        lit = count;
        // Allume les premières pastilles (attribut data-on) et éteint les autres.
        [...orbsRef.current.children].forEach((el, i) => el.toggleAttribute('data-on', i < count));
      // Fin de la mise à jour des pastilles.
      }

      // La vidéo rattrape la barre : lecture plus ou moins rapide, pause quand elle est à jour.
      // Récupère la balise vidéo.
      const video = videoRef.current;
      // Durée de la vidéo, 0 si elle est inconnue.
      const duration = video && Number.isFinite(video.duration) ? video.duration : 0;
      // Si la vidéo existe, a une durée et a assez de données pour afficher une image.
      if (video && duration > 0 && video.readyState >= 2) {
        // Vitesse de lecture selon le retard de la vidéo sur la barre, plafonnée.
        const rate = videoRate(p * duration - video.currentTime, maxRate);
        // Début du bloc protégé : le navigateur peut refuser une vitesse.
        try {
          // Vitesse nulle : met la vidéo en pause, si elle ne l'est pas déjà.
          if (rate === 0) { if (!video.paused) video.pause(); }
          // Sinon.
          else {
            // Change la vitesse de lecture seulement si elle diffère.
            if (video.playbackRate !== rate) video.playbackRate = rate;
            // Relance la lecture si la vidéo est en pause et pas terminée ; un refus est ignoré.
            if (video.paused && !video.ended) video.play().catch(() => {});
          // Fin du cas « vitesse non nulle ».
          }
        // Vitesse refusée : la vitesse maximale est divisée par deux, sans descendre sous 2.
        } catch { maxRate = Math.max(2, maxRate / 2); }
      // Fin du pilotage de la vidéo.
      }

      // Barre pleine : lance le fondu de sortie et arrête la boucle.
      if (p >= 1) { setLeaving(true); return; }
      // Programme l'image suivante.
      raf = requestAnimationFrame(tick);
    // Fin de tick.
    };
    // Lance la boucle.
    raf = requestAnimationFrame(tick);
    // Nettoyage : arrête la boucle au démontage.
    return () => cancelAnimationFrame(raf);
  // Fin de l'effet ; aucune dépendance.
  }, []);

  // Effet du fondu de sortie.
  useEffect(() => {
    // Rien à faire tant que le fondu n'a pas commencé.
    if (!leaving) return undefined;
    // Prévient le parent que la scène peut être révélée.
    onReveal?.(); // la scène redevient visible à travers le fondu
    // Prévient le parent que tout est fini, après la durée du fondu.
    const id = setTimeout(() => onDone?.(), FADE_MS);
    // Nettoyage : annule ce délai.
    return () => clearTimeout(id);
  // Fin de l'effet ; dépendances : le fondu et les deux rappels.
  }, [leaving, onDone, onReveal]);

  // Début du rendu.
  return (
    // Fond de l'écran de chargement (début de la balise).
    <Box
      // Rôle d'état pour les lecteurs d'écran.
      role="status"
      // Changements annoncés sans interrompre la lecture en cours.
      aria-live="polite"
      // Début du style.
      sx={{
        // Couvre toute la fenêtre, au-dessus des fenêtres modales, fond noir, sans débordement.
        position: 'fixed', inset: 0, zIndex: (t) => t.zIndex.modal + 30, overflow: 'hidden', bgcolor: '#000',
        // Fond visible tant que la vidéo n'est pas arrivée (ou si elle est injoignable) : lueurs bleue et ambrée de l'app.
        // Deux halos en dégradé radial : un bleu en haut à gauche et (ligne suivante) un ambré en bas à droite.
        backgroundImage: `radial-gradient(60% 50% at 18% 12%, rgba(0, 0, 255, 0.22), transparent 70%),
          radial-gradient(70% 60% at 85% 100%, rgba(240, 178, 74, 0.16), transparent 70%)`,
        // Transparent et sans interaction pendant le fondu de sortie.
        opacity: leaving ? 0 : 1, pointerEvents: leaving ? 'none' : 'auto',
        // Transition d'opacité de la durée du fondu.
        transition: `opacity ${FADE_MS}ms ease`,
      // Fin du style.
      }}
    // Fin de la balise ouvrante.
    >
      {/* S'il y a une vidéo (début). */}
      {src && (
        // La vidéo (début de la balise).
        <Box
          // Rendue en balise video.
          component="video"
          // Référence pour la piloter.
          ref={videoRef}
          // Adresse de la vidéo.
          src={src}
          // Sans son.
          muted
          // Lecture dans la page (pas de plein écran automatique sur téléphone).
          playsInline
          // Préchargement complet.
          preload="auto"
          // Pas de mode image dans l'image.
          disablePictureInPicture
          // Cachée aux lecteurs d'écran.
          aria-hidden
          // Première image chargée : la vidéo peut apparaître.
          onLoadedData={() => setVideoReady(true)}
          // Couvre tout l'écran en le remplissant ; apparaît en fondu de 500 ms quand elle est prête.
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: videoReady ? 1 : 0, transition: 'opacity 500ms ease' }}
        // Fin de la vidéo.
        />
      // Fin du cas « vidéo ».
      )}
      {/* Voile : garde la Lune visible au centre, assombrit les bords pour le texte. */}
      {/* Voile en dégradé radial : transparent au centre, sombre sur les bords. */}
      <Box sx={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 90% at 50% 40%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.72) 100%)' }} />

      {/* Si un contenu est fourni (début). */}
      {children && (
        // Il est centré sur tout l'écran.
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', p: 2 }}>{children}</Box>
      // Fin du contenu.
      )}

      {/* Carte de chargement : même verre sombre que les panneaux de l'app. */}
      {/* La carte de chargement (début de la balise). */}
      <Box
        // Début du style.
        sx={{
          // Centrée horizontalement, à 28 px du bas, au-dessus de la zone de sécurité.
          position: 'absolute', left: '50%', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)', transform: 'translateX(-50%)',
          // Large de 560 px au plus, marge intérieure selon l'écran, coins arrondis.
          width: 'min(560px, calc(100% - 28px))', p: { xs: 2, sm: 2.5 }, borderRadius: '16px',
          // Fond sombre translucide, bordure fine, flou d'arrière-plan.
          bgcolor: 'rgba(9, 13, 22, 0.72)', border: '1px solid rgba(160, 180, 220, 0.16)', backdropFilter: 'blur(14px)',
          // Ombre portée.
          boxShadow: '0 18px 60px rgba(0, 0, 0, 0.55)',
        // Fin du style.
        }}
      // Fin de la balise ouvrante.
      >
        {/* Ligne du logo et du nom. */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
          {/* Le logo (début de la balise). */}
          <Box
            // Rendu en balise img.
            component="img"
            // Adresse du logo (le paramètre v force le rechargement).
            src="/logo.webp?v=4"
            // Texte alternatif vide : image décorative.
            alt=""
            // Non déplaçable.
            draggable={false}
            // Large de 72 ou 96 px selon l'écran, proportions gardées.
            sx={{ width: { xs: 72, sm: 96 }, height: 'auto', flex: 'none', objectFit: 'contain' }}
          // Fin du logo.
          />
          {/* Le nom de l'application (début de la balise). */}
          <Typography
            // Rendu en paragraphe.
            component="p"
            // Jamais traduit.
            translate="no"
            // Ligne flexible qui passe à la ligne, taille selon l'écran, demi-gras, encre claire.
            sx={{ m: 0, minWidth: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: '0.3em', fontSize: { xs: '1.15rem', sm: '1.4rem' }, fontWeight: 600, lineHeight: 1.2, color: INK }}
          // Fin de la balise ouvrante.
          >
            {/* Le symbole ∞ en bleu de la marque, deux fois plus grand, décoratif. */}
            <Box component="span" aria-hidden="true" sx={{ color: BRAND_BLUE, fontSize: '2em', lineHeight: 0.8, fontWeight: 700 }}>∞</Box>
            {/* Le nom de l'application. */}
            Go白ناन्टех
            {/* La suite du nom, en encre atténuée, décorative. */}
            <Box component="span" aria-hidden="true" sx={{ color: DIM, fontWeight: 400 }}>α΄一하나א</Box>
            {/* Le badge « En direct ». */}
            <LiveBadge sx={{ ml: '0.2em' }} />
          {/* Fin du nom. */}
          </Typography>
        {/* Fin de la ligne du logo et du nom. */}
        </Box>

        {/* Astres de la Navigation : chaque pastille s'allume à sa couleur quand la barre l'atteint. */}
        {/* La rangée de pastilles (début de la balise). */}
        <Box
          // Référence pour les allumer.
          ref={orbsRef}
          // Cachée aux lecteurs d'écran.
          aria-hidden="true"
          // Début du style.
          sx={{
            // Pastilles réparties sur toute la largeur, avec des marges.
            display: 'flex', justifyContent: 'space-between', mt: 2, mb: 1, px: '2px',
            // Style de chaque pastille (début).
            '& > span': {
              // Rond de 10 px, presque éteint, légèrement réduit.
              width: 10, height: 10, borderRadius: '50%', opacity: 0.22, transform: 'scale(0.8)',
              // Reflet clair sur la couleur de l'astre (variable --c).
              background: 'radial-gradient(circle at 32% 28%, rgba(255,255,255,.8), transparent 22%), var(--c)',
              // Transitions d'opacité, de taille (avec rebond) et de halo.
              transition: 'opacity .3s ease, transform .3s cubic-bezier(.3,1.6,.5,1), box-shadow .3s ease',
            // Fin du style d'une pastille.
            },
            // Pastille allumée : opaque, à taille réelle, avec un halo de sa couleur.
            '& > span[data-on]': { opacity: 1, transform: 'scale(1)', boxShadow: '0 0 10px var(--c)' },
          // Fin du style.
          }}
        // Fin de la balise ouvrante.
        >
          {/* Une pastille par couleur, qui reçoit sa couleur dans la variable --c. */}
          {BODY_COLORS.map((c) => <span key={c} style={{ '--c': c }} />)}
        {/* Fin de la rangée de pastilles. */}
        </Box>

        {/* Barre : le dégradé parcourt les couleurs des astres ; il est découvert, pas étiré. */}
        {/* Le rail de la barre : 6 px de haut, arrondi, gris-bleu translucide. */}
        <Box sx={{ position: 'relative', height: 6, borderRadius: 99, bgcolor: 'rgba(160, 180, 220, 0.2)' }}>
          {/* Le remplissage (début de la balise). */}
          <Box
            // Référence pour le découvrir.
            ref={fillRef}
            // Couvre le rail avec le dégradé des astres ; entièrement rogné au départ.
            sx={{ position: 'absolute', inset: 0, borderRadius: 99, background: SPECTRUM, clipPath: 'inset(0 100% 0 0 round 99px)', willChange: 'clip-path' }}
          // Fin du remplissage.
          />
        {/* Fin du rail. */}
        </Box>

        {/* Ligne du libellé et du pourcentage, aux deux extrémités. */}
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mt: 1.25 }}>
          {/* Le libellé de l'étape, en encre atténuée. */}
          <Typography variant="body2" sx={{ color: DIM }}>{label}</Typography>
          {/* Le pourcentage, en ambre, gras, à chiffres de largeur fixe ; « 0 % » au départ. */}
          <Typography ref={percentRef} variant="body2" sx={{ color: SUN, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>0 %</Typography>
        {/* Fin de la ligne. */}
        </Box>

        {/* Étapes du démarrage : une coche par étape finie. */}
        {/* Liste des étapes, sans puces, cachée aux lecteurs d'écran. */}
        <Box component="ul" aria-hidden="true" sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', listStyle: 'none', p: 0, m: 0, mt: 1 }}>
          {/* Une entrée par étape (le libellé est renommé name). */}
          {STEPS.map(({ id, label: name }) => {
            // L'étape est-elle finie ?
            const done = stepDone(id, step, leaving);
            // Début du rendu de l'entrée.
            return (
              // L'entrée (début de la balise).
              <Box
                // Rendue en balise li.
                component="li"
                // Clé unique : l'identifiant de l'étape.
                key={id}
                // Coche et nom côte à côte, en petit ; encre claire si l'étape est finie, atténuée sinon.
                sx={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 12, color: done ? INK : DIM, transition: 'color .3s ease' }}
              // Fin de la balise ouvrante.
              >
                {/* La coche (début de la balise). */}
                <Box
                  // Rendue en balise span.
                  component="span"
                  // Début du style.
                  sx={{
                    // Rond de 14 px, contenu centré, petit caractère.
                    width: 14, height: 14, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 10, lineHeight: 1,
                    // Bordure et fond ambrés si l'étape est finie ; bordure grise et fond transparent sinon ; signe noir.
                    border: `1px solid ${done ? SUN : 'rgba(160, 180, 220, 0.4)'}`, color: '#000', bgcolor: done ? SUN : 'transparent',
                    // Transition des couleurs de fond et de bordure.
                    transition: 'background-color .3s ease, border-color .3s ease',
                  // Fin du style.
                  }}
                // Fin de la balise ouvrante.
                >
                  {/* La coche si l'étape est finie, rien sinon. */}
                  {done ? <CheckIcon sx={{ fontSize: 11 }} /> : ''}
                {/* Fin de la coche. */}
                </Box>
                {/* Le nom de l'étape. */}
                {name}
              {/* Fin de l'entrée. */}
              </Box>
            // Fin du rendu de l'entrée.
            );
          // Fin des entrées.
          })}
        {/* Fin de la liste des étapes. */}
        </Box>
      {/* Fin de la carte de chargement. */}
      </Box>
    {/* Fin du fond. */}
    </Box>
  // Fin du rendu.
  );
// Fin de LoadingScreen.
}

// Exporte aussi le composant par défaut.
export default LoadingScreen;
