/**
 * Zones de l'écran du téléphone (voir theme/layout) : la zone du titre en haut et le dock en bas mesurent leur place
 * réelle et la publient, en pixels, dans des variables CSS (--hud-top, --hud-bottom…) et dans un petit magasin que
 * les composants peuvent lire (la navball, le cadre GPS et le moteur, qui calcule les coordonnées des coins visibles).
 */
// Hooks de React.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

// Valeurs mesurées, en pixels : limite basse de la zone du titre, hauteur du dock, et du bas du dock.
const zones = { top: 0, bottom: 0, base: 0 };
// Abonnés aux changements.
const listeners = new Set();
// Instantané (nouvel objet à chaque changement, pour useSyncExternalStore).
let snapshot = { ...zones };

/** Valeurs des zones (pixels). */
// Déclare et exporte getZones.
export const getZones = () => snapshot;
/** Abonnement aux changements des zones ; renvoie la fonction de désabonnement. */
// Déclare et exporte subscribeZones : la fonction appelée à chaque changement.
export const subscribeZones = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
/** Les zones, relues à chaque changement (composant React). */
// Déclare et exporte useZoneValues.
export const useZoneValues = () => useSyncExternalStore(subscribeZones, getZones, getZones);

/** Pose une zone : variable CSS (--hud-<nom>) et magasin, sans rien faire si la valeur n'a pas changé. */
// Déclare et exporte setZone : le nom (top, bottom, base) et la valeur en pixels.
export function setZone(name, px) {
  // Arrondie au pixel.
  const v = Math.max(0, Math.round(px));
  // Inchangée : rien.
  if (zones[name] === v) return;
  // Gardée.
  zones[name] = v;
  // Variable CSS sur la page (lue par les sx des composants).
  if (typeof document !== 'undefined') {
    // Nom de la variable : --hud-top, --hud-bottom, --dock-base.
    const css = name === 'base' ? '--dock-base' : `--hud-${name}`;
    // Posée en pixels.
    document.documentElement.style.setProperty(css, `${v}px`);
  // Fin de la page.
  }
  // Nouvel instantané.
  snapshot = { ...zones };
  // Prévient les abonnés.
  listeners.forEach((fn) => fn(snapshot));
// Fin de setZone.
}

/**
 * Mesure un élément et publie sa place : `edge` = 'top' (sa limite basse, depuis le haut de la fenêtre) ou 'bottom'
 * (sa hauteur depuis le bas de la fenêtre). Remesure à chaque changement de taille de l'élément (ResizeObserver) et
 * de la fenêtre (rotation, barre d'adresse). Remet la zone à 0 quand l'élément disparaît. Renvoie la ref à poser.
 */
// Déclare et exporte useZoneMeasure : le nom de la zone et le bord mesuré.
export function useZoneMeasure(name, edge) {
  // L'élément mesuré.
  const node = useRef(null);
  // Mesure (début).
  const measure = useCallback(() => {
    // L'élément.
    const el = node.current;
    // Absent : rien.
    if (!el) return;
    // Son rectangle.
    const r = el.getBoundingClientRect();
    // Limite basse depuis le haut, ou hauteur depuis le bas de la fenêtre.
    setZone(name, edge === 'top' ? r.bottom : window.innerHeight - r.top);
  // Fin de la mesure ; dépendances : le nom et le bord.
  }, [name, edge]);
  // Abonnements (début).
  useEffect(() => {
    // Sans navigateur : rien.
    if (typeof window === 'undefined') return undefined;
    // Observateur de taille.
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    // Observe l'élément.
    if (node.current) ro?.observe(node.current);
    // Fenêtre et zone visible (clavier, barre d'adresse).
    window.addEventListener('resize', measure);
    // Zone visible.
    window.visualViewport?.addEventListener('resize', measure);
    // Première mesure, puis une autre après la mise en page.
    measure(); const t = setTimeout(measure, 250);
    // Nettoyage : désabonnements et zone remise à 0.
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure); window.visualViewport?.removeEventListener('resize', measure); clearTimeout(t); setZone(name, 0); };
  // Fin des abonnements.
  }, [measure, name]);
  // La ref.
  return node;
// Fin de useZoneMeasure.
}

/**
 * Hauteur du clavier virtuel du téléphone, en pixels (0 s'il est fermé). Lue sur visualViewport : sur iOS, un élément
 * en position fixe reste collé au bas de la page, derrière le clavier ; cette hauteur permet de le remonter au-dessus.
 */
// Déclare et exporte useKeyboardInset.
export function useKeyboardInset() {
  // Hauteur.
  const [inset, setInset] = useState(0);
  // Abonnement (début).
  useEffect(() => {
    // Zone visible du navigateur.
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    // Absente : rien.
    if (!vv) return undefined;
    // Hauteur cachée en bas par le clavier.
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    // Première lecture.
    update();
    // Changements de la zone visible.
    vv.addEventListener('resize', update);
    // Défilement de la zone visible.
    vv.addEventListener('scroll', update);
    // Nettoyage.
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  // Fin de l'abonnement.
  }, []);
  // La hauteur.
  return inset;
// Fin de useKeyboardInset.
}
