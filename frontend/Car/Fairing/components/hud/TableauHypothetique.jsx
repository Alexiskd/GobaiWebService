// « Tableau hypothétique » de l'onglet « Théorie quantique » : les systèmes stellaires et substellaires à moins de
// 16,3 années-lumière, dessinés comme un tableau périodique (une case par système, rang 0 = le Système solaire /
// Solarium, rang 1 = Alpha Centauri qui contient Proxima Centauri / le Proximium), avec en dessous la liste complète
// des composantes individuelles (type spectral, distance, masse).
// Fragment de React, pour grouper les lignes d'un système.
import { Fragment } from 'react';
// Composants MUI.
import { Box, Table, TableBody, TableCell, TableRow, Typography } from '@mui/material';
// Données : les systèmes et leurs composantes.
import { SYSTEMES, ALPHA_CENTAURI } from './tableauHypothetique.js';

// Grille du dessin : 7 colonnes, taille d'une case, écart, pas et marge (unités du viewBox).
const COLS = 7, CASE_L = 88, CASE_H = 52, ECART = 4, PAS_X = CASE_L + ECART, PAS_Y = CASE_H + ECART, MARGE = 8;
// Nombre de lignes de la grille.
const LIGNES = Math.ceil(SYSTEMES.length / COLS);
// Largeur et hauteur du dessin.
const LARG = MARGE * 2 + COLS * PAS_X - ECART;
const HAUT = MARGE * 2 + LIGNES * PAS_Y - ECART;

/** Le tableau hypothétique en SVG : une case par système, rang en haut à gauche, code au centre, masse en bas. */
// GrilleSystemes : dessine les cases des systèmes.
function GrilleSystemes() {
  // Début du rendu.
  return (
    // Le dessin (début de la balise).
    <Box
      // Rendu en balise svg, avec son repère de coordonnées et le rôle d'image.
      component="svg" viewBox={`0 0 ${LARG} ${HAUT}`} role="img"
      // Description pour les lecteurs d'écran : le nombre de systèmes et les deux cases remarquables.
      aria-label={`Tableau hypothétique : ${SYSTEMES.length} systèmes à moins de 16,3 années-lumière, du Système solaire (rang 0, Solarium) à 40 Eridani (rang 48) ; Alpha Centauri (rang 1) contient Proxima Centauri, le Proximium`}
      // Toute la largeur, hauteur proportionnelle, couleur secondaire pour les textes.
      sx={{ display: 'block', width: '100%', height: 'auto', color: 'text.secondary', mt: 1 }}
    // Fin de la balise ouvrante.
    >
      {/* Une case par système (début). */}
      {SYSTEMES.map((s, i) => {
        // La position de la case dans la grille.
        const x = MARGE + (i % COLS) * PAS_X, y = MARGE + Math.floor(i / COLS) * PAS_Y;
        // La case est-elle remarquable : rang 0 (Système solaire / Solarium) ou rang 1 (Alpha Centauri / Proximium).
        const solarium = s.rang === 0, proximium = s === ALPHA_CENTAURI;
        // Le fond et le texte de la case : surbrillance primaire pour le Solarium, secondaire pour le Proximium.
        const fond = solarium ? (t) => t.palette.primary.main : proximium ? (t) => t.palette.secondary.main : 'action.hover';
        const bord = solarium ? (t) => t.palette.primary.light : proximium ? (t) => t.palette.secondary.light : 'divider';
        const texte = solarium ? (t) => t.palette.primary.contrastText : proximium ? (t) => t.palette.secondary.contrastText : 'currentColor';
        // Le rendu de la case.
        return (
          // Le groupe de la case.
          <g key={s.rang}>
            {/* Le rectangle de la case. */}
            <Box component="rect" x={x} y={y} width={CASE_L} height={CASE_H} rx={5} sx={{ fill: fond, stroke: bord, strokeWidth: solarium || proximium ? 1.5 : 1 }} />
            {/* Le rang, en haut à gauche, en petits caractères. */}
            <Box component="text" x={x + 5} y={y + 11} fontSize="8" sx={{ fill: texte }}>{s.rang}</Box>
            {/* Le code du système, centré, en gras. */}
            <Box component="text" x={x + CASE_L / 2} y={y + 27} fontSize="12.5" fontWeight="700" textAnchor="middle" sx={{ fill: texte }}>{s.code}</Box>
            {/* La masse de la composante principale, en bas de case. */}
            <Box component="text" x={x + CASE_L / 2} y={y + CASE_H - 8} fontSize="7.5" textAnchor="middle" sx={{ fill: texte }}>{s.composantes[0].masse}</Box>
            {/* Infobulle : le nom complet, la distance et les composantes. */}
            <title>{`${s.rang} · ${s.nom} — ${s.composantes[0].distance} a.l. — ${s.composantes.map((c) => c.nom).join(', ')}`}</title>
          {/* Fin du groupe. */}
          </g>
        );
      // Fin des cases.
      })}
    {/* Fin du dessin. */}
    </Box>
  // Fin du rendu.
  );
// Fin de GrilleSystemes.
}

// Déclare et exporte le composant TableauHypothetique : la grille des systèmes, puis la liste de leurs composantes.
export function TableauHypothetique() {
  // Début du rendu.
  return (
    // Le conteneur.
    <Box>
      {/* La grille des systèmes. */}
      <GrilleSystemes />
      {/* Le titre de la liste détaillée. */}
      <Typography component="h4" variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 2, mt: 2, mb: 0.5 }}>
        {/* Son texte. */}
        Toutes les composantes (type spectral, distance, masse)
      {/* Fin du titre. */}
      </Typography>
      {/* Le tableau détaillé, en chiffres de largeur fixe. */}
      <Table size="small" sx={{ mt: 0.5, '& td': { fontVariantNumeric: 'tabular-nums' } }}>
        {/* Corps du tableau. */}
        <TableBody>
          {/* Un système par groupe de lignes (début). */}
          {SYSTEMES.map((s) => (
            // Les lignes du système, une par composante.
            <Fragment key={s.rang}>
              {s.composantes.map((c, i) => (
                // La ligne de la composante.
                <TableRow key={`${s.rang}-${i}`}>
                  {/* Le rang, affiché seulement sur la première composante du système. */}
                  <TableCell sx={{ pl: 0, color: 'text.secondary', whiteSpace: 'nowrap' }}>{i === 0 ? s.rang : ''}</TableCell>
                  {/* Le nom du système, seulement sur la première composante. */}
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{i === 0 ? s.nom : ''}</TableCell>
                  {/* La composante. */}
                  <TableCell>{c.nom}</TableCell>
                  {/* Le type spectral. */}
                  <TableCell sx={{ color: 'text.secondary' }}>{c.type}</TableCell>
                  {/* La distance, alignée à droite. */}
                  <TableCell align="right">{c.distance}</TableCell>
                  {/* La masse, alignée à droite. */}
                  <TableCell align="right" sx={{ pr: 0 }}>{c.masse}</TableCell>
                {/* Fin de la ligne. */}
                </TableRow>
              ))}
            {/* Fin des composantes. */}
            </Fragment>
          // Fin des systèmes.
          ))}
        {/* Fin du corps. */}
        </TableBody>
      {/* Fin du tableau. */}
      </Table>
    {/* Fin du conteneur. */}
    </Box>
  // Fin du rendu.
  );
// Fin de TableauHypothetique.
}
