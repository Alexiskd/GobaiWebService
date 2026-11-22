// Importe useMediaQuery du kit : vrai quand une requête média est satisfaite.
import { useMediaQuery } from '@/Fairing/kit';
// Importe useMemo, qui garde le même objet tant que rien ne change.
import { useMemo } from 'react';
// Importe les requêtes média de l'interface.
import { QUERIES } from '@/Fairing/theme/mediaQueries';

/**
 * Catégorie d'écran : taille (xs à xl), mode compact (téléphone, ou écran bas et tactile), tablette, pointeur
 * tactile, écran bas, paysage. L'objet renvoyé ne change que lorsqu'une de ces valeurs change.
 */
// Déclare et exporte le crochet useViewport.
export function useViewport() {
  // Les largeurs.
  const xs = useMediaQuery(QUERIES.xs);
  const sm = useMediaQuery(QUERIES.sm);
  const md = useMediaQuery(QUERIES.md);
  const lg = useMediaQuery(QUERIES.lg);
  // Pointeur tactile, écran bas, paysage.
  const coarse = useMediaQuery(QUERIES.coarse);
  const short = useMediaQuery(QUERIES.short);
  const landscape = useMediaQuery(QUERIES.landscape);
  // Calcul mémorisé de la catégorie.
  return useMemo(() => {
    // Taille : la première requête satisfaite.
    const size = xs ? 'xs' : sm ? 'sm' : md ? 'md' : lg ? 'lg' : 'xl';
    // Renvoie la catégorie.
    return {
      size,
      // Compact : petit écran, ou écran bas et tactile (téléphone en paysage).
      compact: sm || (short && coarse),
      tablet: size === 'md',
      coarse,
      short,
      landscape,
    };
  // Fin du calcul ; dépendances : les sept requêtes.
  }, [xs, sm, md, lg, coarse, short, landscape]);
// Fin de useViewport.
}
