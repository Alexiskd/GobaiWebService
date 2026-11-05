import { GlobalStyles } from '@mui/material';
import { layoutStyles } from './styles/layoutStyles';
import { controlStyles } from './styles/controlStyles';

// Mise en page : sections empilées dans un ordre fixe, chacune avec un titre court en capitales et un contenu en
// « carte » (lignes de même hauteur séparées par un filet). Libellés à gauche, valeurs et interrupteurs alignés à
// droite. Classes préfixées `ac-` et styles MUI (`GlobalStyles`) : la feuille globale ne peut plus les décaler.
// Ordre de cascade conservé : mise en page, puis contrôles, état et règles tactiles / écrans étroits.
const adaptiveStyles = { ...layoutStyles, ...controlStyles };

export function AdaptiveStyles() {
  return <GlobalStyles styles={adaptiveStyles} />;
}
