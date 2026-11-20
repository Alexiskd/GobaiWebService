// Section « Caractéristiques d'un élément du tableau périodique » de l'onglet « Théorie quantique » : le numéro
// atomique Z (charge du noyau +Z·e, Z électrons, rang dans le tableau, loi de Moseley) et la masse atomique A_r
// (1 u = 1/12 du carbone 12, moyenne pondérée des isotopes, lien masse molaire), avec la comparaison demandée :
// le nombre de systèmes à une seule étoile (sans problème à 3 corps) du tableau hypothétique.
// Composants MUI.
import { Box, Typography } from '@mui/material';
// Les calculs (charge du noyau, exemple du chlore).
import { E_CHARGE, U_KG, NA, chargeNoyau, masseAtomiqueChlore, masseMolaireChlore, CHLORE } from './caracteristiquesElement.js';
// Les systèmes du tableau hypothétique, pour compter ceux à une seule étoile.
import { SYSTEMES } from './tableauHypothetique.js';

// Le nombre de systèmes à une seule étoile (une seule composante, donc aucun problème à 3 corps) et le total.
const MONOETOILES = SYSTEMES.filter((s) => s.composantes.length === 1).length;
const TOTAL = SYSTEMES.length;
// Importe scientific, qui écrit un nombre en notation scientifique française.
import { scientific } from '@/Engine/AstreSolideEngine/planetData';

// Style des formules : police à chasse fixe, coupure à la ligne, fond léger.
const FORMULE_SX = {
  m: 0, p: 1.25, borderRadius: 1, border: 1, borderColor: 'divider', bgcolor: 'action.hover',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '0.8rem',
  whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
};

// Déclare et exporte le composant CaracteristiquesElement.
export function CaracteristiquesElement() {
  // Début du rendu.
  return (
    // Le conteneur.
    <Box>
      {/* Z : définition et conséquences. */}
      <Typography component="h4" variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 2, mt: 1, mb: 0.5 }}>
        {/* Son titre. */}
        Z — le numéro atomique
      {/* Fin du titre. */}
      </Typography>
      {/* Le texte sur Z. */}
      <Typography variant="body2" color="text.secondary">
        {/* Son contenu : Z = nombre de protons, identifiant unique de l'élément. */}
        Z est le nombre de protons du noyau : un entier positif (Z ≥ 1) qui identifie l’élément. La charge du noyau
        vaut toujours <strong>+Z·e</strong> (les neutrons sont neutres) — par exemple le Solarium (Z = 119) aurait un
        noyau de +{scientific(chargeNoyau(119), 3)} C — et l’atome neutre possède exactement <strong>Z électrons</strong>,
        qui dictent ses propriétés chimiques. Dans la notation ᴬ_Z X, A = Z + N est le nombre de masse (N = neutrons).
        Les 118 éléments sont rangés par Z croissant (H = 1 … Og = 118). La lettre Z vient de l’allemand Zahl /
        Ordnungszahl ; la loi de Moseley (1913) a prouvé que la fréquence des rayons X émis varie en (Z − b)² : Z est
        la charge réelle du noyau, pas un simple numéro d’ordre.
      {/* Fin du texte. */}
      </Typography>

      {/* Masse atomique. */}
      <Typography component="h4" variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 2, mt: 2, mb: 0.5 }}>
        {/* Son titre. */}
        A_r — la masse atomique
      {/* Fin du titre. */}
      </Typography>
      {/* Le texte sur la masse atomique. */}
      <Typography variant="body2" color="text.secondary">
        {/* Son contenu : définition de l'u et moyenne pondérée des isotopes. */}
        1 u vaut exactement 1/12 de la masse d’un atome de carbone 12, soit ≈ {scientific(U_KG, 2)} kg. La masse
        atomique A_r d’un élément est la moyenne pondérée des masses de ses isotopes, pondérées par leurs abondances
        mesurées — sans référence à un « présent sur Terre » qui n’a pas de sens ici. Exemple du chlore (Z = 17) :
      {/* Fin du texte. */}
      </Typography>
      {/* La formule du chlore. */}
      <Box component="pre" sx={{ ...FORMULE_SX, mt: 0.5 }}>{`A_r(Cl) = ${CHLORE.m35} × ${String(CHLORE.p35 * 100).replace('.', ',')} % + ${CHLORE.m37} × ${String(CHLORE.p37 * 100).replace('.', ',')} %`}</Box>
      {/* Le résultat calculé. */}
      <Typography variant="body2" sx={{ mt: 0.5 }}>
        {/* Sa valeur : ≈ 35,45 u, et lien masse molaire. */}
        = <strong>{masseAtomiqueChlore().toFixed(2).replace('.', ',')} u</strong> (arrondi à 35,45 u dans le tableau).
        Grâce au nombre d’Avogadro (N_A ≈ {scientific(NA, 2)} mol⁻¹), la valeur numérique de A_r en u est identique à
        la masse molaire en g/mol : ici {masseMolaireChlore().toFixed(2).replace('.', ',')} g/mol. La masse réelle d’un
        noyau est toujours un peu inférieure à Z·m_p + N·m_n : le défaut de masse Δm est converti en énergie de liaison
        (E = Δm·c²).
      {/* Fin du résultat. */}
      </Typography>

      {/* La comparaison demandée avec les systèmes à une seule étoile. */}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        {/* Son texte : comparaison isotopes ↔ systèmes simples. */}
        <strong>Comparaison :</strong> du côté des systèmes stellaires, le tableau hypothétique compte{' '}
        <strong>{MONOETOILES}</strong> systèmes découverts à une seule étoile — sans problème à trois corps —
        sur <strong>{TOTAL}</strong> au total (les {TOTAL - MONOETOILES} autres sont des systèmes multiples).
      {/* Fin de la comparaison. */}
      </Typography>
    {/* Fin du conteneur. */}
    </Box>
  // Fin du rendu.
  );
// Fin de CaracteristiquesElement.
}
