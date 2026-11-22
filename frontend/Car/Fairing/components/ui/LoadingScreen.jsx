// Importe de React les crochets useEffect, useRef et useState.
import { useEffect, useRef, useState } from 'react';
// Importe le badge « En direct ».
import { LiveBadge } from './LiveBadge.jsx';
// Importe les calculs de la progression : vitesses maximales de la vidéo, avance de la barre, vitesse de fin, vitesse de lecture.
import { VIDEO_MAX_RATE, VIDEO_MAX_RATE_HANDHELD, advanceProgress, finishRate, videoRate } from '@/Engine/shared/lib/app/loadingProgress';
// Importe isHandheld, qui dit si l'appareil est un appareil tenu en main.
import { isHandheld } from '@/Engine/AstreSolideEngine/PerfEngine/powerSaver';
// Importe la coche des étapes franchies.
import { CheckIcon } from './icons.jsx';

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
    <div
      // Rôle d'état pour les lecteurs d'écran.
      role="status"
      // Changements annoncés sans interrompre la lecture en cours.
      aria-live="polite"
      // Début du style.
      className={`fixed inset-0 z-[1330] overflow-hidden bg-[#000] [background-image:radial-gradient(60%_50%_at_18%_12%,rgba(0,0,255,0.22),transparent_70%),radial-gradient(70%_60%_at_85%_100%,rgba(240,178,74,0.16),transparent_70%)] ${leaving ? 'opacity-0' : 'opacity-100'} ${leaving ? 'pointer-events-none' : 'pointer-events-auto'}`} style={{ transition: `opacity ${FADE_MS}ms ease` }}
    // Fin de la balise ouvrante.
    >
      {/* S'il y a une vidéo (début). */}
      {src && (
        // La vidéo (début de la balise).
        <video
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
          className={`absolute inset-0 w-full h-full object-cover ${videoReady ? 'opacity-100' : 'opacity-0'} [transition:opacity_500ms_ease]`}
        // Fin de la vidéo.
        />
      // Fin du cas « vidéo ».
      )}
      {/* Voile : garde la Lune visible au centre, assombrit les bords pour le texte. */}
      {/* Voile en dégradé radial : transparent au centre, sombre sur les bords. */}
      <div className="absolute inset-0 [background:radial-gradient(120%_90%_at_50%_40%,rgba(0,0,0,0)_35%,rgba(0,0,0,0.72)_100%)]" />

      {/* Si un contenu est fourni (début). */}
      {children && (
        // Il est centré sur tout l'écran.
        <div className="absolute inset-0 grid place-items-center p-4">{children}</div>
      // Fin du contenu.
      )}

      {/* Carte de chargement : même verre sombre que les panneaux de l'app. */}
      {/* La carte de chargement (début de la balise). */}
      <div
        // Début du style.
        className="absolute left-1/2 bottom-[calc(env(safe-area-inset-bottom,0px)_+_28px)] [transform:translateX(-50%)] w-[min(560px,calc(100%_-_28px))] p-4 min-[600px]:p-5 rounded-[16px] bg-[color:rgba(9,13,22,0.72)] border border-[color:rgba(160,180,220,0.16)] [box-shadow:0_18px_60px_rgba(0,0,0,0.55)]"
      // Fin de la balise ouvrante.
      >
        {/* Ligne du logo et du nom. */}
        <div className="flex items-center gap-3.5">
          {/* Le logo (début de la balise). */}
          <img
            // Adresse du logo (le paramètre v force le rechargement).
            src="/logo.webp?v=4"
            // Texte alternatif vide : image décorative.
            alt=""
            // Non déplaçable.
            draggable={false}
            // Large de 72 ou 96 px selon l'écran, proportions gardées.
            className="w-18 min-[600px]:w-24 h-auto flex-none object-contain"
          // Fin du logo.
          />
          {/* Le nom de l'application (début de la balise). */}
          <p
            // Jamais traduit.
            translate="no"
            // Ligne flexible qui passe à la ligne, taille selon l'écran, demi-gras, encre claire.
            className="t-body1 m-0 min-w-0 flex items-center flex-wrap gap-x-[0.3em] text-[1.15rem] min-[600px]:text-[1.4rem] font-semibold leading-[1.2] text-[#e8edf8]"
          // Fin de la balise ouvrante.
          >
            {/* Le symbole ∞ en bleu de la marque, deux fois plus grand, décoratif. */}
            <span aria-hidden="true" className="text-[#0000FF] text-[2em] leading-[0.8] font-bold">∞</span>
            {/* Le nom de l'application. */}
            Go白ناन्टех
            {/* La suite du nom, en encre atténuée, décorative. */}
            <span aria-hidden="true" className="text-[#8b97b3] font-normal">α΄一하나א</span>
            {/* Le badge « En direct ». */}
            <LiveBadge className="ml-[0.2em]" />
          {/* Fin du nom. */}
          </p>
        {/* Fin de la ligne du logo et du nom. */}
        </div>

        {/* Astres de la Navigation : chaque pastille s'allume à sa couleur quand la barre l'atteint. */}
        {/* La rangée de pastilles (début de la balise). */}
        <div
          // Référence pour les allumer.
          ref={orbsRef}
          // Cachée aux lecteurs d'écran.
          aria-hidden="true"
          // Début du style.
          className="flex justify-between mt-4 mb-2 px-[2px] [&_>_span]:w-2.5 [&_>_span]:h-2.5 [&_>_span]:rounded-full [&_>_span]:opacity-22 [&_>_span]:[transform:scale(0.8)] [&_>_span]:[background:radial-gradient(circle_at_32%_28%,rgba(255,255,255,.8),transparent_22%),var(--c)] [&_>_span]:[transition:opacity_.3s_ease,transform_.3s_cubic-bezier(.3,1.6,.5,1),box-shadow_.3s_ease] [&_>_span[data-on]]:opacity-100 [&_>_span[data-on]]:[transform:scale(1)] [&_>_span[data-on]]:[box-shadow:0_0_10px_var(--c)]"
        // Fin de la balise ouvrante.
        >
          {/* Une pastille par couleur, qui reçoit sa couleur dans la variable --c. */}
          {BODY_COLORS.map((c) => <span key={c} style={{ '--c': c }} />)}
        {/* Fin de la rangée de pastilles. */}
        </div>

        {/* Barre : le dégradé parcourt les couleurs des astres ; il est découvert, pas étiré. */}
        {/* Le rail de la barre : 6 px de haut, arrondi, gris-bleu translucide. */}
        <div className="relative h-1.5 rounded-full bg-[color:rgba(160,180,220,0.2)]">
          {/* Le remplissage (début de la balise). */}
          <div
            // Référence pour le découvrir.
            ref={fillRef}
            // Couvre le rail avec le dégradé des astres ; entièrement rogné au départ.
            className="absolute inset-0 rounded-full [clip-path:inset(0_100%_0_0_round_99px)] [will-change:clip-path]" style={{ background: SPECTRUM }}
          // Fin du remplissage.
          />
        {/* Fin du rail. */}
        </div>

        {/* Ligne du libellé et du pourcentage, aux deux extrémités. */}
        <div className="flex items-baseline justify-between gap-4 mt-2.5">
          {/* Le libellé de l'étape, en encre atténuée. */}
          <p className="t-body2 text-[#8b97b3]">{label}</p>
          {/* Le pourcentage, en ambre, gras, à chiffres de largeur fixe ; « 0 % » au départ. */}
          <p ref={percentRef} className="t-body2 text-[#f0b24a] font-bold tabular-nums">0 %</p>
        {/* Fin de la ligne. */}
        </div>

        {/* Étapes du démarrage : une coche par étape finie. */}
        {/* Liste des étapes, sans puces, cachée aux lecteurs d'écran. */}
        <ul aria-hidden="true" className="flex gap-4 flex-wrap list-none p-0 m-0 mt-2">
          {/* Une entrée par étape (le libellé est renommé name). */}
          {STEPS.map(({ id, label: name }) => {
            // L'étape est-elle finie ?
            const done = stepDone(id, step, leaving);
            // Début du rendu de l'entrée.
            return (
              // L'entrée (début de la balise).
              <li
                // Clé unique : l'identifiant de l'étape.
                key={id}
                // Coche et nom côte à côte, en petit ; encre claire si l'étape est finie, atténuée sinon.
                className={`inline-flex items-center gap-[6px] text-[12px] ${done ? 'text-[#e8edf8]' : 'text-[#8b97b3]'} [transition:color_.3s_ease]`}
              // Fin de la balise ouvrante.
              >
                {/* La coche (début de la balise). */}
                <span
                  // Début du style.
                  className={`w-3.5 h-3.5 rounded-full grid place-items-center text-[10px] leading-none text-[#000] ${done ? 'bg-[#f0b24a]' : 'bg-transparent'} [transition:background-color_.3s_ease,border-color_.3s_ease]`} style={{ border: `1px solid ${done ? SUN : 'rgba(160, 180, 220, 0.4)'}` }}
                // Fin de la balise ouvrante.
                >
                  {/* La coche si l'étape est finie, rien sinon. */}
                  {done ? <CheckIcon className="text-[11px]" /> : ''}
                {/* Fin de la coche. */}
                </span>
                {/* Le nom de l'étape. */}
                {name}
              {/* Fin de l'entrée. */}
              </li>
            // Fin du rendu de l'entrée.
            );
          // Fin des entrées.
          })}
        {/* Fin de la liste des étapes. */}
        </ul>
      {/* Fin de la carte de chargement. */}
      </div>
    {/* Fin du fond. */}
    </div>
  // Fin du rendu.
  );
// Fin de LoadingScreen.
}

// Exporte aussi le composant par défaut.
export default LoadingScreen;
