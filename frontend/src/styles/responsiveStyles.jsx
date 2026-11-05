import { GlobalStyles } from '@mui/material';
import { baseStyles } from './responsiveBase';
import { toolbarStyles } from './responsiveToolbar';
import { sharedStyles } from './responsiveShared';
import { screenStyles } from './responsiveScreens';
import { compactStyles } from './responsiveCompact';
import { smallScreenStyles } from './responsiveSmallScreens';
import { motionStyles } from './responsiveMotion';
import { wikiStyles } from './responsiveWiki';

// Styles MUI (ex responsive.css), découpés par zone.
// Paliers : xs ≤480 · sm ≤720 · md ≤1024 · lg ≤1440 · xl >1440.
// Le préfixe `html` augmente la spécificité pour passer devant la feuille de style principale.
// L'ordre des morceaux fixe l'ordre des règles CSS : ne pas le modifier.
const responsiveStyles = {
  ...baseStyles,
  ...toolbarStyles,
  ...sharedStyles,
  ...screenStyles,
  ...compactStyles,
  ...smallScreenStyles,
  ...motionStyles,
  ...wikiStyles, // thème clair « encyclopédie » (blanc et noir) : toujours en dernier
};

/** Injecte tous les styles responsive (MUI / Emotion). Objet constant : sérialisé une seule fois. */
export function ResponsiveStyles() {
  return <GlobalStyles styles={responsiveStyles} />;
}
