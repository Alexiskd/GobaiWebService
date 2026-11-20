// Fonction de React qui applique un changement tout de suite.
import { flushSync } from 'react-dom';

/** Durée du fondu entre le thème de jour et le thème de nuit (la même que le fondu de l'ombre des astres). */
// Durée du fondu : 600 ms.
export const THEME_FADE_MS = 600;

/**
 * Fondu enchaîné du changement de thème, fait par le navigateur (View Transitions API) : il photographie l'écran
 * avant le changement, applique le nouveau thème d'un coup, puis fond l'ancienne image vers la nouvelle. Le fondu
 * n'anime qu'une opacité, sur la carte graphique : aucune couleur n'est recalculée image par image.
 *
 * Remplace l'ancienne méthode (une transition CSS posée sur tous les éléments de la page), qui obligeait le navigateur
 * à recalculer et repeindre chaque élément à chaque image pendant le fondu.
 *
 * `apply` change le thème ; il est exécuté de façon synchrone (flushSync) pour que la nouvelle image soit prête quand
 * le navigateur la photographie. Sans cette API, ou si le système demande un mouvement réduit : changement immédiat.
 */
// Fonction withThemeTransition.
export function withThemeTransition(apply) {
  // L'utilisateur demande-t-il moins d'animations ?
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // Hors navigateur, sans l'API de transition, ou avec animations réduites :
  if (typeof document === 'undefined' || typeof document.startViewTransition !== 'function' || reduced) {
    // change le thème ;
    apply();
    // fin.
    return;
  // Fin du cas.
  }
  // Élément racine de la page.
  const root = document.documentElement;
  // Y pose l'attribut du fondu.
  root.setAttribute(FADE_ATTR, ''); // posé avant la photo : les éléments du HUD reçoivent leur propre calque de fondu
  // Fonction done : le retire.
  const done = () => root.removeAttribute(FADE_ATTR);
  // Essaie
  try {
    // de lancer la transition, qui applique le thème tout de suite ;
    const transition = document.startViewTransition(() => { flushSync(apply); });
    // à la fin, réussie ou non, retire l'attribut.
    transition.finished.then(done, done);
  // En cas d'échec :
  } catch {
    // retire l'attribut ;
    done();
    // change le thème quand même.
    apply(); // transition refusée par le navigateur : le thème change quand même
  // Fin du cas.
  }
// Fin de withThemeTransition.
}

/** Attribut posé sur <html> le temps du fondu ; attribut qui désigne la scène 3D, exclue du fondu. */
// Attribut posé pendant le fondu.
export const FADE_ATTR = 'data-theme-fade';
// Attribut qui désigne la scène 3D.
export const SCENE_ATTR = 'data-scene';

// Réglages du fondu : sa durée, à vitesse constante.
const fade = { animationDuration: `${THEME_FADE_MS}ms`, animationTimingFunction: 'linear' };

/**
 * Styles globaux du fondu.
 *
 * La scène 3D ne doit jamais être figée : une photo de l'écran entier arrêterait la rotation des astres pendant le
 * fondu. Quand le navigateur sait nommer les éléments tout seul (`match-element`), chaque élément du HUD est donc
 * photographié et fondu à part, et la page elle-même (la scène) reste en direct, sans photo : les astres continuent de
 * tourner et leur ombre se fond dans le moteur. Sinon, repli sur le fondu de la page entière.
 */
// Styles globaux du fondu :
export const themeTransitionStyles = {
  // fondu de la page entière ;
  '::view-transition-old(root), ::view-transition-new(root)': fade,
  // si le navigateur sait nommer les éléments tout seul :
  '@supports (view-transition-name: match-element)': {
    // chaque élément du HUD reçoit son propre calque ;
    [`html[${FADE_ATTR}] [${SCENE_ATTR}] ~ *`]: { viewTransitionName: 'match-element', viewTransitionClass: 'hud' },
    // l'ancienne image de la page n'est pas montrée ;
    '::view-transition-old(root)': { display: 'none' },
    // la nouvelle n'est pas animée ;
    '::view-transition-new(root)': { animation: 'none' },
    // durée du groupe des éléments du HUD ;
    '::view-transition-group(*.hud)': { animationDuration: `${THEME_FADE_MS}ms` },
    // fondu de chaque élément du HUD.
    '::view-transition-old(*.hud), ::view-transition-new(*.hud)': fade,
  // Fin du cas.
  },
// Fin des styles.
};
