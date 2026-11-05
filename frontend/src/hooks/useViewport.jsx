import { useMediaQuery } from '@mui/material';
import { useMemo } from 'react';
import { QUERIES } from '@/styles/mediaQueries';

// Catégories d’écran (voir `QUERIES`) :
//  - xs  ≤ 480 px   : téléphone portrait
//  - sm  ≤ 720 px   : grand téléphone / petite tablette  → mode « compact »
//  - md  ≤ 1024 px  : tablette
//  - lg  ≤ 1440 px  : ordinateur portable
//  - xl  > 1440 px  : grand écran / TV
// En mode compact : pas de glisser-déposer des panneaux, panneau d’infos en tiroir bas,
// barre d’outils réduite avec menu « Plus », palette plein écran, sources repliables.

/** Catégorie d'écran courante (MUI `useMediaQuery`) ; ne re-rend que lorsque la catégorie change. */
export function useViewport() {
  const opts = { noSsr: true };
  const xs = useMediaQuery(QUERIES.xs, opts);
  const sm = useMediaQuery(QUERIES.sm, opts);
  const md = useMediaQuery(QUERIES.md, opts);
  const lg = useMediaQuery(QUERIES.lg, opts);
  const coarse = useMediaQuery(QUERIES.coarse, opts);
  const short = useMediaQuery(QUERIES.short, opts);
  const landscape = useMediaQuery(QUERIES.landscape, opts);
  return useMemo(() => {
    const size = xs ? 'xs' : sm ? 'sm' : md ? 'md' : lg ? 'lg' : 'xl';
    return {
      size,
      compact: sm || (short && coarse),
      tablet: size === 'md',
      coarse,
      short,
      landscape,
    };
  }, [xs, sm, md, lg, coarse, short, landscape]);
}
