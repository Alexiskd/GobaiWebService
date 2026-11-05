import { useCallback, useEffect, useRef, useState } from 'react';

// Son synthétisé avec la Web Audio API (aucun fichier audio à charger) : une note sinusoïdale
// très courte dont la hauteur monte brusquement, comme une bulle qui éclate.
// Joué sur tout élément cliquable de l’interface, coupé via le bouton « Son » de la barre.

const SOUND_STORAGE_KEY = 'gobai:sound';
const CLICKABLE = [
  'button',
  'a[href]',
  'summary',
  'label',
  'select',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="file"]',
  '[role="button"]',
  '[role="option"]',
  '[role="switch"]',
  '[role="menuitem"]',
  '[role="tab"]',
].join(', ');
const BUBBLE_MIN_GAP_MS = 45; // un clic sur un <label> déclenche aussi un clic sur son <input> : un seul son

let audioCtx = null;
let lastBubble = 0;

function playBubble() {
  const now = performance.now();
  if (now - lastBubble < BUBBLE_MIN_GAP_MS) return;
  lastBubble = now;
  const AudioCtor = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AudioCtor) return;
  try {
    audioCtx ??= new AudioCtor();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime;
    // Légère variation à chaque clic pour éviter un son mécanique.
    const base = 340 + Math.random() * 160;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 2.8, t + 0.06);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.16, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);

    osc.connect(filter).connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
    osc.onended = () => { osc.disconnect(); filter.disconnect(); gain.disconnect(); };
  } catch {
    // Audio bloqué ou indisponible : l'interface continue sans son.
  }
}

const readSoundPref = () => {
  try { return localStorage.getItem(SOUND_STORAGE_KEY) !== 'off'; } catch { return true; }
};

/** Écoute tous les clics de la page et joue la bulle sur les éléments cliquables. Renvoie [actif, basculer]. */
export function useBubbleSound() {
  const [enabled, setEnabled] = useState(readSoundPref);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    const onClick = (event) => {
      if (!enabledRef.current) return;
      const target = event.target instanceof Element ? event.target.closest(CLICKABLE) : null;
      if (!target || target.closest('[data-no-sound]')) return;
      if (target.matches(':disabled, [aria-disabled="true"]')) return;
      playBubble();
    };
    // Phase de capture : le son part même si un composant arrête la propagation du clic.
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  const toggle = useCallback(() => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    try { localStorage.setItem(SOUND_STORAGE_KEY, next ? 'on' : 'off'); } catch { /* stockage indisponible */ }
    if (next) playBubble(); // confirme que le son est réactivé
  }, []);

  return [enabled, toggle];
}
