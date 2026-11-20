// Section « Charge électrique du Soleil selon T » de l'onglet « Théorie quantique » : la description des calculs
// reliant la température T (K) à la charge électrique Q (C) — charge nette (Eddington / Pannekoek-Rosseland),
// charge coronale et charge ionisée (Saha) — avec les formules et les valeurs calculées en direct.
// Composants MUI.
import { Box, Table, TableBody, TableCell, TableRow, Typography } from '@mui/material';
// Les calculs et le tableau de synthèse.
import { CONSTANTES, qNette, qCouronne, qIonisee, tauxIonisation, LIGNES_SYNTHESE } from './chargeSoleil.js';
// Importe scientific, qui écrit un nombre en notation scientifique française.
import { scientific } from '@/Engine/AstreSolideEngine/planetData';

// Style des formules : police à chasse fixe, coupure à la ligne, fond léger.
const FORMULE_SX = {
  m: 0, p: 1.25, borderRadius: 1, border: 1, borderColor: 'divider', bgcolor: 'action.hover',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '0.8rem',
  whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
};

// Déclare et exporte le composant ChargeSoleil : la description des trois calculs et le tableau de synthèse.
export function ChargeSoleil() {
  // Début du rendu.
  return (
    // Le conteneur.
    <Box>
      {/* L'introduction : les deux réalités physiques. */}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {/* Son texte : charge totale libérée vs charge nette. */}
        Deux réalités : la <strong>charge totale libérée</strong> par le plasma ionisé (la chaleur arrache les électrons
        à H et He : des charges +Q et −Q libres qui s’équilibrent presque parfaitement) et la <strong>charge nette</strong>{' '}
        Q_nette — légèrement positive, car les électrons, ~43 fois plus légers que les protons à même température T,
        tendent à s’échapper : un champ électrique radial (équilibre d’Eddington / Pannekoek-Rosseland) retient les
        électrons. À l’échelle macroscopique, Q_nette reste minuscule : le plasma est quasi neutre.
      {/* Fin de l'introduction. */}
      </Typography>

      {/* Premier calcul. */}
      <Typography component="h4" variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 2, mt: 2, mb: 0.5 }}>
        {/* Son titre : la charge nette statique. */}
        1 · Charge nette statique — indépendante de T
      {/* Fin du titre. */}
      </Typography>
      {/* La formule. */}
      <Box component="pre" sx={FORMULE_SX}>{'Q_nette = 2π ε₀ G m_p M☉ / e'}</Box>
      {/* La valeur calculée. */}
      <Typography variant="body2" sx={{ mt: 0.5 }}>
        {/* Sa valeur : ≈ +77 C. */}
        = <strong>+{qNette().toFixed(0)} C</strong> (avec M☉ = {scientific(CONSTANTES.M_SOL, 3)} kg, m_p = {scientific(CONSTANTES.mP, 2)} kg)
      {/* Fin de la valeur. */}
      </Typography>

      {/* Deuxième calcul. */}
      <Typography component="h4" variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 2, mt: 2, mb: 0.5 }}>
        {/* Son titre : la charge coronale, proportionnelle à T. */}
        2 · Charge nette coronale — proportionnelle à T
      {/* Fin du titre. */}
      </Typography>
      {/* La formule. */}
      <Box component="pre" sx={FORMULE_SX}>{'Q_couronne = 4π ε₀ R☉ k_B T / e'}</Box>
      {/* La valeur à la température de la couronne. */}
      <Typography variant="body2" sx={{ mt: 0.5 }}>
        {/* Sa valeur : ≈ +10 C à 1,5 × 10⁶ K. */}
        = <strong>+{qCouronne(CONSTANTES.T_COURONNE).toFixed(0)} C</strong> à T = 1,5 × 10⁶ K (couronne), soit{' '}
        {scientific(qCouronne(1000), 2)} C par millier de kelvins
      {/* Fin de la valeur. */}
      </Typography>

      {/* Troisième calcul. */}
      <Typography component="h4" variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 2, mt: 2, mb: 0.5 }}>
        {/* Son titre : la charge ionisée via Saha. */}
        3 · Charge totale ionisée — équation de Saha, x(T) = exp(−χ_H / k_B T)
      {/* Fin du titre. */}
      </Typography>
      {/* La formule. */}
      <Box component="pre" sx={FORMULE_SX}>{'Q₊ = x(T) · e · (M☉/m_p) · (X + Y/2)   et   −Q₊ pour les électrons'}</Box>
      {/* Les valeurs. */}
      <Typography variant="body2" sx={{ mt: 0.5 }}>
        {/* Ses valeurs : seuil à ~10 000 K, quasi-total au cœur. */}
        Seuil d’ionisation vers 10 000 K (x = {scientific(tauxIonisation(1e4), 2)}) ; au cœur, T = 1,57 × 10⁷ K, x ={' '}
        {tauxIonisation(CONSTANTES.T_COEUR).toFixed(2).replace('.', ',')} donc Q₊ = <strong>+{scientific(qIonisee(CONSTANTES.T_COEUR), 3)} C</strong>{' '}
        (et −{scientific(qIonisee(CONSTANTES.T_COEUR), 3)} C d’électrons).
      {/* Fin des valeurs. */}
      </Typography>

      {/* Le tableau de synthèse. */}
      <Table size="small" sx={{ mt: 1.5, '& td': { fontVariantNumeric: 'tabular-nums' } }}>
        {/* Corps du tableau. */}
        <TableBody>
          {/* Une ligne par grandeur (début). */}
          {LIGNES_SYNTHESE.map((l) => (
            // La ligne.
            <TableRow key={l.grandeur}>
              {/* La grandeur, en en-tête de ligne. */}
              <TableCell component="th" scope="row" sx={{ pl: 0, verticalAlign: 'top' }}>{l.grandeur}</TableCell>
              {/* La formule de passage depuis T. */}
              <TableCell sx={{ fontFamily: FORMULE_SX.fontFamily, fontSize: '0.75rem' }}>{l.formule}</TableCell>
              {/* La valeur pour le Soleil et sa note. */}
              <TableCell align="right" sx={{ pr: 0, verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                {/* La valeur calculée. */}
                {scientific(l.valeur, 3)} {l.unite}
                {/* La note, en dessous. */}
                <Typography component="div" variant="caption" color="text.secondary" sx={{ whiteSpace: 'normal' }}>{l.note}</Typography>
              </TableCell>
            {/* Fin de la ligne. */}
            </TableRow>
          // Fin des lignes.
          ))}
        {/* Fin du corps. */}
        </TableBody>
      {/* Fin du tableau. */}
      </Table>
      {/* La conclusion. */}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {/* Son texte : quasi-neutralité. */}
        Synthèse : la charge ionisée totale est immense (±1,63 × 10³⁸ C) mais s’équilibre ; la charge nette,
        elle, n’est que de quelques dizaines de coulombs (+77 C statique, +10 C coronale à 1,5 × 10⁶ K) — le Soleil
        reste globalement quasi neutre.
      {/* Fin de la conclusion. */}
      </Typography>
    {/* Fin du conteneur. */}
    </Box>
  // Fin du rendu.
  );
// Fin de ChargeSoleil.
}
