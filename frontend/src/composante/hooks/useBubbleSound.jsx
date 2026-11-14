// Importe de React les crochets useCallback, useEffect, useRef et useState.
import { useCallback, useEffect, useRef, useState } from 'react';

// Son synthétisé avec la Web Audio API (aucun fichier audio à charger) : une note sinusoïdale
// très courte dont la hauteur monte brusquement, comme une bulle qui éclate.
// Joué sur tout élément cliquable de l’interface, coupé via le bouton « Son » de la barre.

// Clé du stockage local où est gardée la préférence de son.
const SOUND_STORAGE_KEY = 'gobai:sound';
// Liste des sélecteurs CSS des éléments considérés comme cliquables (début du tableau).
const CLICKABLE = [
  // Les boutons.
  'button',
  // Les liens qui ont une adresse.
  'a[href]',
  // Les titres des blocs dépliables.
  'summary',
  // Les libellés de champs.
  'label',
  // Les listes déroulantes.
  'select',
  // Les cases à cocher.
  'input[type="checkbox"]',
  // Les boutons radio.
  'input[type="radio"]',
  // Les champs de choix de fichier.
  'input[type="file"]',
  // Les éléments au rôle de bouton.
  '[role="button"]',
  // Les éléments au rôle d'option de liste.
  '[role="option"]',
  // Les éléments au rôle d'interrupteur.
  '[role="switch"]',
  // Les éléments au rôle d'entrée de menu.
  '[role="menuitem"]',
  // Les éléments au rôle d'onglet.
  '[role="tab"]',
// Fin du tableau, réuni en un seul sélecteur séparé par des virgules.
].join(', ');
// Intervalle minimal entre deux sons, en millisecondes.
const BUBBLE_MIN_GAP_MS = 45; // un clic sur un <label> déclenche aussi un clic sur son <input> : un seul son

// Contexte audio partagé, créé au premier son.
let audioCtx = null;
// Instant du dernier son joué.
let lastBubble = 0;

// Déclare playBubble, qui joue le son de bulle.
function playBubble() {
  // Lit l'instant présent (horloge précise du navigateur).
  const now = performance.now();
  // Si le dernier son est trop récent, on ne joue rien.
  if (now - lastBubble < BUBBLE_MIN_GAP_MS) return;
  // Mémorise l'instant de ce son.
  lastBubble = now;
  // Cherche le constructeur de contexte audio (standard ou préfixé WebKit), s'il y a une fenêtre.
  const AudioCtor = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  // Sans Web Audio, on abandonne.
  if (!AudioCtor) return;
  // Début du bloc protégé : toute erreur audio est ignorée.
  try {
    // Crée le contexte audio s'il n'existe pas encore.
    audioCtx ??= new AudioCtor();
    // Si le navigateur a suspendu le contexte, on le relance.
    if (audioCtx.state === 'suspended') audioCtx.resume();
    // Lit l'heure courante du contexte audio, base de toute la programmation du son.
    const t = audioCtx.currentTime;
    // Légère variation à chaque clic pour éviter un son mécanique.
    // Fréquence de départ tirée au hasard entre 340 et 500 Hz.
    const base = 340 + Math.random() * 160;

    // Crée l'oscillateur, la source du son.
    const osc = audioCtx.createOscillator();
    // Crée le nœud de gain, qui règle le volume.
    const gain = audioCtx.createGain();
    // Crée le filtre.
    const filter = audioCtx.createBiquadFilter();
    // Onde sinusoïdale, au timbre doux.
    osc.type = 'sine';
    // Fréquence de départ fixée à l'instant t.
    osc.frequency.setValueAtTime(base, t);
    // La fréquence monte de façon exponentielle jusqu'à 2,8 fois la base en 60 ms : l'effet de bulle.
    osc.frequency.exponentialRampToValueAtTime(base * 2.8, t + 0.06);
    // Filtre passe-bas, qui coupe les aigus.
    filter.type = 'lowpass';
    // Fréquence de coupure du filtre : 2 400 Hz.
    filter.frequency.setValueAtTime(2400, t);
    // Volume presque nul au départ (une rampe exponentielle ne peut pas partir de zéro).
    gain.gain.setValueAtTime(0.0001, t);
    // Montée très rapide du volume jusqu'à 0,16 en 6 ms.
    gain.gain.exponentialRampToValueAtTime(0.16, t + 0.006);
    // Puis extinction du volume jusqu'à presque zéro à 110 ms.
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);

    // Chaîne audio : oscillateur, puis filtre, puis gain, puis sortie du contexte.
    osc.connect(filter).connect(gain).connect(audioCtx.destination);
    // Démarre l'oscillateur à l'instant t.
    osc.start(t);
    // Arrête l'oscillateur 120 ms plus tard.
    osc.stop(t + 0.12);
    // À la fin du son, débranche les trois nœuds pour libérer la mémoire.
    osc.onended = () => { osc.disconnect(); filter.disconnect(); gain.disconnect(); };
  // En cas d'erreur audio : rien à faire.
  } catch {
    // Audio bloqué ou indisponible : l'interface continue sans son.
  // Fin du bloc try/catch.
  }
// Fin de playBubble.
}

// Déclare readSoundPref, qui lit la préférence de son enregistrée.
const readSoundPref = () => {
  // Son actif sauf si la valeur enregistrée vaut « off » ; si le stockage est inaccessible, son actif.
  try { return localStorage.getItem(SOUND_STORAGE_KEY) !== 'off'; } catch { return true; }
// Fin de readSoundPref.
};

/** Écoute tous les clics de la page et joue la bulle sur les éléments cliquables. Renvoie [actif, basculer]. */
// Déclare et exporte le crochet useBubbleSound.
export function useBubbleSound() {
  // État : son actif ou non, initialisé avec la préférence enregistrée.
  const [enabled, setEnabled] = useState(readSoundPref);
  // Référence qui garde la valeur courante, lisible depuis l'écouteur sans le recréer.
  const enabledRef = useRef(enabled);
  // Met la référence à jour à chaque rendu.
  enabledRef.current = enabled;

  // Effet exécuté une seule fois : pose l'écouteur de clics.
  useEffect(() => {
    // Déclare onClick, appelé à chaque clic dans la page.
    const onClick = (event) => {
      // Si le son est coupé, on ne fait rien.
      if (!enabledRef.current) return;
      // Cherche l'élément cliquable le plus proche de la cible du clic, si cette cible est bien un élément.
      const target = event.target instanceof Element ? event.target.closest(CLICKABLE) : null;
      // Rien à faire si aucun élément cliquable n'est trouvé, ou s'il est dans une zone marquée data-no-sound.
      if (!target || target.closest('[data-no-sound]')) return;
      // Rien à faire si l'élément est désactivé.
      if (target.matches(':disabled, [aria-disabled="true"]')) return;
      // Joue le son de bulle.
      playBubble();
    // Fin de onClick.
    };
    // Phase de capture : le son part même si un composant arrête la propagation du clic.
    // Écoute les clics sur tout le document, en phase de capture.
    document.addEventListener('click', onClick, true);
    // Nettoyage : retire l'écouteur au démontage.
    return () => document.removeEventListener('click', onClick, true);
  // Fin de l'effet ; aucune dépendance : une seule exécution.
  }, []);

  // toggle : active ou coupe le son ; début de la fonction mémorisée.
  const toggle = useCallback(() => {
    // Calcule le nouvel état, inverse de l'état courant.
    const next = !enabledRef.current;
    // Met tout de suite la référence à jour.
    enabledRef.current = next;
    // Met l'état à jour, ce qui déclenche un nouveau rendu.
    setEnabled(next);
    // Enregistre la préférence (« on » ou « off ») ; une erreur de stockage est ignorée.
    try { localStorage.setItem(SOUND_STORAGE_KEY, next ? 'on' : 'off'); } catch { /* stockage indisponible */ }
    // Si le son vient d'être activé, joue une bulle.
    if (next) playBubble(); // confirme que le son est réactivé
  // Fin de toggle ; fonction stable.
  }, []);

  // Renvoie l'état du son et la fonction de bascule.
  return [enabled, toggle];
// Fin de useBubbleSound.
}
