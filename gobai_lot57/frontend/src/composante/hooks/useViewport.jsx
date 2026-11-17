// Importe useMediaQuery de MUI, qui indique si une requête média CSS est satisfaite.
import { useMediaQuery } from '@mui/material';
// Importe useMemo de React, pour mémoriser un résultat calculé.
import { useMemo } from 'react';
// Importe QUERIES, la table des requêtes média de l'application.
import { QUERIES } from '@/composante/theme/mediaQueries';

// Catégories d’écran (voir `QUERIES`) :
//  - xs  ≤ 480 px   : téléphone portrait
//  - sm  ≤ 720 px   : grand téléphone / petite tablette  → mode « compact »
//  - md  ≤ 1024 px  : tablette
//  - lg  ≤ 1440 px  : ordinateur portable
//  - xl  > 1440 px  : grand écran / TV
// En mode compact : pas de glisser-déposer des panneaux, panneau d’infos en tiroir bas,
// toutes les actions dans la feuille du bouton ⋯ (en haut à droite), qui monte du bas de l'écran, palette plein écran, sources repliables.

/** Catégorie d'écran courante (MUI `useMediaQuery`) ; ne re-rend que lorsque la catégorie change. */
// Déclare et exporte le crochet useViewport.
export function useViewport() {
  // Options de useMediaQuery : pas de rendu côté serveur, la valeur réelle est lue dès le premier rendu.
  const opts = { noSsr: true };
  // xs : vrai sur un téléphone en portrait.
  const xs = useMediaQuery(QUERIES.xs, opts);
  // sm : vrai sur un grand téléphone ou une petite tablette.
  const sm = useMediaQuery(QUERIES.sm, opts);
  // md : vrai sur une tablette.
  const md = useMediaQuery(QUERIES.md, opts);
  // lg : vrai sur un ordinateur portable.
  const lg = useMediaQuery(QUERIES.lg, opts);
  // coarse : vrai si le pointeur est imprécis (doigt).
  const coarse = useMediaQuery(QUERIES.coarse, opts);
  // short : vrai si l'écran est peu haut.
  const short = useMediaQuery(QUERIES.short, opts);
  // landscape : vrai si l'écran est en mode paysage.
  const landscape = useMediaQuery(QUERIES.landscape, opts);
  // Mémorise l'objet renvoyé : il ne change que si l'une des réponses change.
  return useMemo(() => {
    // Catégorie d'écran : la première requête satisfaite, de la plus petite à la plus grande ; « xl » sinon.
    const size = xs ? 'xs' : sm ? 'sm' : md ? 'md' : lg ? 'lg' : 'xl';
    // Début de l'objet renvoyé.
    return {
      // La catégorie d'écran.
      size,
      // Mode compact : écran de taille sm (ou moins), ou écran peu haut et tactile.
      compact: sm || (short && coarse),
      // Vrai si la catégorie est celle des tablettes.
      tablet: size === 'md',
      // Pointeur imprécis (doigt).
      coarse,
      // Écran peu haut.
      short,
      // Écran en paysage.
      landscape,
    // Fin de l'objet renvoyé.
    };
  // Fin du calcul mémorisé ; dépendances : toutes les réponses des requêtes média.
  }, [xs, sm, md, lg, coarse, short, landscape]);
// Fin de useViewport.
}
