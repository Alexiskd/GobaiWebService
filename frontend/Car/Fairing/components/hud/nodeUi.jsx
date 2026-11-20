// Briques de style communes à tous les onglets de la fenêtre Node. Avant, chaque onglet redéclarait son propre titre
// de section, son bloc de formule et son étiquette : sept copies qui divergeaient. Tout onglet se compose désormais
// des mêmes pièces — Section, Carte, Chiffre, Formule, Etiquette, Note, Fiche — pour une seule apparence.
// Composants MUI.
import { Box, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

// Police à chasse fixe des formules, des adresses et des nombres alignés.
export const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/**
 * Section d'un onglet : un numéro d'ordre à chasse fixe, le titre, un sous-titre facultatif, puis le contenu.
 * Le numéro sert de repère de lecture dans les onglets longs (la théorie quantique en compte huit).
 */
// Déclare et exporte Section : numéro, titre, sous-titre, action à droite du titre et contenu.
export function Section({ numero, titre, sousTitre, action, children, sx }) {
  // Début du rendu.
  return (
    // La section, séparée de ce qui précède par une marge ; seule une section placée en tête d'onglet n'en a pas.
    <Box component="section" aria-label={titre} sx={{ mt: 4, '&:first-child': { mt: 0.5 }, minWidth: 0, ...sx }}>
      {/* En-tête : numéro, titre et action, soulignés d'un trait fin. */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, pb: 0.75, mb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        {/* Le numéro d'ordre, s'il y en a un. */}
        {numero != null && (
          <Box component="span" aria-hidden="true" sx={{ fontFamily: MONO, fontSize: '0.75rem', color: 'primary.main', flex: 'none' }}>
            {String(numero).padStart(2, '0')}
          </Box>
        )}
        {/* Le titre et son sous-titre. */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{titre}</Typography>
          {sousTitre && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{sousTitre}</Typography>}
        </Box>
        {/* L'action facultative (compteur, bouton). */}
        {action}
      </Box>
      {/* Le contenu de la section. */}
      {children}
    </Box>
  );
// Fin de Section.
}

/** Sous-titre à l'intérieur d'une section. */
// Déclare et exporte SousTitre : reçoit un contenu.
export const SousTitre = ({ children, sx }) => (
  // Titre de niveau 4, petites capitales espacées, couleur secondaire.
  <Typography component="h4" variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 1.8, mt: 2.5, mb: 0.75, ...sx }}>
    {children}
  </Typography>
);

/** Surface bordée : regroupe un dessin, un tableau ou un bloc de texte. `accent` colore le bord gauche. */
// Déclare et exporte Carte : couleur d'accent facultative, contenu et style.
export const Carte = ({ accent, children, sx, ...rest }) => (
  // Boîte à bordure fine et fond léger ; le bord gauche prend la couleur d'accent si elle est donnée.
  <Box
    {...rest}
    sx={{
      minWidth: 0, p: { xs: 1.5, sm: 2 }, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'action.hover',
      ...(accent ? { borderLeft: 3, borderLeftColor: accent } : null), ...sx,
    }}
  >
    {children}
  </Box>
);

/** Grille de chiffres clés : autant de colonnes que la largeur le permet. */
// Déclare et exporte GrilleChiffres : largeur minimale d'une colonne et contenu.
export const GrilleChiffres = ({ min = 150, children, sx }) => (
  // Grille qui se replie toute seule sur téléphone.
  <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 1, ...sx }}>{children}</Box>
);

/** Chiffre clé : un libellé, une valeur en grand (chiffres alignés) et une précision facultative. */
// Déclare et exporte Chiffre : libellé, valeur, précision et couleur de la valeur.
export const Chiffre = ({ libelle, valeur, detail, couleur = 'text.primary' }) => (
  // La tuile du chiffre.
  <Carte sx={{ p: 1.5 }}>
    {/* Le libellé, en petit. */}
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>{libelle}</Typography>
    {/* La valeur, en grand, à chiffres de largeur fixe. */}
    <Typography component="p" sx={{ mt: 0.5, fontSize: '1.15rem', fontWeight: 700, lineHeight: 1.2, color: couleur, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{valeur}</Typography>
    {/* La précision, si elle existe. */}
    {detail && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, lineHeight: 1.35 }}>{detail}</Typography>}
  </Carte>
);

/** Formule ou bloc de code : chasse fixe, bord gauche coloré, retour à la ligne automatique. */
// Déclare et exporte Formule : reçoit un contenu.
export const Formule = ({ children, sx }) => (
  // Bloc préformaté qui ne déborde jamais en largeur.
  <Box
    component="pre"
    sx={{
      m: 0, px: 1.5, py: 1.1, borderRadius: 1.5, border: 1, borderColor: 'divider', borderLeft: 3, borderLeftColor: 'primary.main',
      bgcolor: 'action.hover', fontFamily: MONO, fontSize: '0.82rem', lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', ...sx,
    }}
  >
    {children}
  </Box>
);

/** Étiquette à bordure : un nom court (source, service, branche). `couleur` la teinte. */
// Déclare et exporte Etiquette : couleur facultative et contenu.
export const Etiquette = ({ couleur, children, sx }) => (
  // Balise en ligne, coupée au besoin.
  <Box
    component="span"
    sx={{
      display: 'inline-block', maxWidth: '100%', overflowWrap: 'anywhere', font: 'inherit', fontSize: '0.8em', fontWeight: 600, lineHeight: 1.5,
      px: 0.75, py: 0.1, border: 1, borderColor: couleur || 'divider', color: couleur || 'inherit', borderRadius: 1, ...sx,
    }}
  >
    {children}
  </Box>
);

/** Texte d'explication, en couleur secondaire. */
// Déclare et exporte Note : reçoit un contenu.
export const Note = ({ children, sx }) => (
  // Paragraphe secondaire, limité en largeur pour rester lisible.
  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: '78ch', lineHeight: 1.6, ...sx }}>{children}</Typography>
);

/** Mise en garde ou remarque importante : une carte au bord coloré. */
// Déclare et exporte Alerte : titre, couleur et contenu.
export const Alerte = ({ titre, couleur = 'warning.main', children, sx }) => (
  // La carte de la remarque.
  <Carte accent={couleur} sx={{ mt: 1.5, ...sx }}>
    {/* Le titre, s'il y en a un. */}
    {titre && <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.25 }}>{titre}</Typography>}
    {/* Le texte. */}
    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>{children}</Typography>
  </Carte>
);

// Style commun des tableaux : pleine largeur, chiffres alignés, bords des cellules extérieures supprimés.
const FICHE_SX = {
  width: '100%',
  '& td, & th': { fontVariantNumeric: 'tabular-nums', verticalAlign: 'top', py: 0.9, px: { xs: 0.75, sm: 2 } },
  '& td:first-of-type, & th:first-of-type': { pl: 0 },
  '& td:last-of-type, & th:last-of-type': { pr: 0 },
  '& tbody tr:last-of-type td, & tbody tr:last-of-type th': { borderBottom: 0 },
};

/**
 * Tableau de la fenêtre Node. `colonnes` : [{ titre, align, largeur, cache }] ; `lignes` : tableaux de cellules.
 * `fixe` coupe les textes longs au lieu d'élargir le tableau (aucun défilement horizontal, même sur téléphone) ;
 * sans `fixe`, le tableau défile dans son cadre quand il est plus large que la fenêtre.
 * `cache: true` masque la colonne sur téléphone.
 */
// Déclare et exporte Fiche : colonnes, lignes, mode fixe, libellé accessible et style.
export function Fiche({ colonnes, lignes, fixe = false, label, sx }) {
  // Une colonne au moins a-t-elle un titre ? Sinon l'en-tête n'est pas rendu.
  const entete = colonnes.some((c) => c.titre);
  // masque : style d'une cellule de colonne masquée sur téléphone.
  const masque = (c) => (c.cache ? { display: { xs: 'none', sm: 'table-cell' } } : null);
  // Début du rendu.
  return (
    // Cadre du tableau : défilement horizontal seulement en mode libre.
    <Box sx={{ maxWidth: '100%', overflowX: fixe ? 'hidden' : 'auto' }}>
      <Table size="small" aria-label={label} sx={{ ...FICHE_SX, ...(fixe ? { tableLayout: 'fixed', '& td, & th': { ...FICHE_SX['& td, & th'], overflowWrap: 'anywhere', wordBreak: 'break-word' } } : null), ...sx }}>
        {/* L'en-tête, si des titres sont donnés. */}
        {entete && (
          <TableHead>
            <TableRow>
              {colonnes.map((c, i) => (
                <TableCell key={i} align={c.align} sx={{ width: c.largeur, lineHeight: 1.3, verticalAlign: 'bottom', ...masque(c) }}>{c.titre}</TableCell>
              ))}
            </TableRow>
          </TableHead>
        )}
        {/* Le corps : une ligne par entrée, une cellule par colonne. */}
        <TableBody>
          {lignes.map((ligne, r) => (
            <TableRow key={r}>
              {colonnes.map((c, i) => (
                <TableCell key={i} align={c.align} sx={{ width: entete ? undefined : c.largeur, ...c.sx, ...masque(c) }}>{ligne[i]}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
// Fin de Fiche.
}

/** Petite ligne sous un nom : adresse, date, précision. Jamais traduite quand `brut` est vrai (adresses). */
// Déclare et exporte Precision : indicateur d'adresse brute, couleur et contenu.
export const Precision = ({ brut = false, couleur = 'text.secondary', children, sx }) => (
  // Ligne en petit, coupée au besoin.
  <Box component="span" translate={brut ? 'no' : undefined} sx={{ display: 'block', fontSize: '0.78em', color: couleur, overflowWrap: 'anywhere', ...(brut ? { fontFamily: MONO } : null), ...sx }}>
    {children}
  </Box>
);
