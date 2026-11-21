// Section « Caractéristiques d'un élément » de l'onglet « Théorie quantique » : le numéro atomique Z, la masse
// atomique A_r (exemple du chlore) et le défaut de masse (exemple de l'hélium 4), avec les valeurs calculées.
// Composants MUI.
import { Box } from '@mui/material';
// Calculs des caractéristiques d'un élément.
import { CHLORE, NA, U_KG, chargeNoyau, defautMasseHelium, energieLiaisonHelium, masseAtomiqueChlore, masseMolaireChlore } from './caracteristiquesElement.js';
// Compteurs du tableau hypothétique : systèmes à une étoile et systèmes multiples.
import { SYSTEMES, countMonoEtoiles, countMultiples } from './tableauHypothetique.js';
// Le Solarium, pour l'exemple de la charge du noyau.
import { SOLARIUM } from './theorieQuantique.js';
// Briques de style communes de la fenêtre Node.
import { Chiffre, Formule, GrilleChiffres, Note, SousTitre } from '../node/nodeUi.jsx';
// Écriture scientifique française.
import { scientific } from '@/Engine/AstreSolideEngine/BodyEngine/planetData';

// virgule : écrit un nombre avec une virgule décimale.
const virgule = (n, d = 2) => n.toFixed(d).replace('.', ',');
// pourcent : écrit une abondance (0,7576) en pourcentage (« 75,76 % »).
const pourcent = (p) => `${virgule(p * 100)} %`;

/** Section complète : chiffres clés, puis Z, A_r et le défaut de masse. */
// Déclare et exporte CaracteristiquesElement.
export function CaracteristiquesElement() {
  // Début du rendu.
  return (
    <Box>
      {/* Chiffres clés. */}
      <GrilleChiffres>
        <Chiffre libelle={`Charge du noyau du Solarium (Z = ${SOLARIUM.z})`} valeur={`+${scientific(chargeNoyau(SOLARIUM.z), 3)} C`} detail="Q = +Z · e" />
        <Chiffre libelle="Masse atomique du chlore" valeur={`${virgule(masseAtomiqueChlore(), 3)} u`} detail="moyenne pondérée de ses deux isotopes" />
        <Chiffre libelle="Énergie de liaison de l’hélium 4" valeur={`${virgule(energieLiaisonHelium(), 1)} MeV`} detail={`${virgule(energieLiaisonHelium() / 4)} MeV par nucléon`} />
      </GrilleChiffres>

      <SousTitre>Z — le numéro atomique</SousTitre>
      <Formule>{'Q_noyau = +Z · e          atome neutre : Z électrons          A = Z + N'}</Formule>
      <Note>
        Z est le nombre de protons du noyau : un entier (Z ≥ 1) qui identifie l’élément. La charge du noyau vaut toujours{' '}
        <strong>+Z·e</strong> (les neutrons sont neutres) et l’atome neutre possède exactement <strong>Z électrons</strong>,
        qui dictent ses propriétés chimiques. A = Z + N est le nombre de masse (N = neutrons). Les 118 éléments sont rangés
        par Z croissant (H = 1 … Og = 118). La loi de Moseley (1913) a montré que la fréquence des rayons X émis varie en
        (Z − b)² : Z est la charge réelle du noyau, pas un simple numéro d’ordre.
      </Note>

      <SousTitre>A_r — la masse atomique</SousTitre>
      <Formule>{`A_r(Cl) = ${virgule(CHLORE.m35, 4)} × ${pourcent(CHLORE.p35)} + ${virgule(CHLORE.m37, 4)} × ${pourcent(CHLORE.p37)} = ${virgule(masseAtomiqueChlore(), 3)} u`}</Formule>
      <Note>
        1 u vaut exactement 1/12 de la masse d’un atome de carbone 12, soit {scientific(U_KG, 4)} kg. La masse atomique d’un
        élément est la moyenne des masses de ses isotopes, pondérée par leurs abondances mesurées. Grâce au nombre
        d’Avogadro (N_A = {scientific(NA, 4)} mol⁻¹), la valeur de A_r en u est aussi la masse molaire en g/mol :{' '}
        {virgule(masseMolaireChlore())} g/mol pour le chlore.
      </Note>

      <SousTitre>Δm — le défaut de masse</SousTitre>
      <Formule>{`Δm(⁴He) = 2 m_p + 2 m_n + 2 m_e − m(⁴He) = ${virgule(defautMasseHelium(), 4)} u          E = Δm · c² = ${virgule(energieLiaisonHelium(), 1)} MeV`}</Formule>
      <Note>
        La masse d’un noyau est toujours un peu inférieure à la somme de ses constituants : la différence est l’énergie de
        liaison, libérée à sa formation. C’est cette énergie qui fait briller le Soleil : la fusion de quatre protons en un
        noyau d’hélium convertit environ 0,7 % de leur masse en rayonnement.
      </Note>

      <Note sx={{ mt: 2 }}>
        <strong>Comparaison avec le voisinage :</strong> sur les {SYSTEMES.length} systèmes du tableau hypothétique,{' '}
        <strong>{countMonoEtoiles()}</strong> n’ont qu’une seule étoile et <strong>{countMultiples()}</strong> sont multiples.
      </Note>
    </Box>
  );
// Fin de CaracteristiquesElement.
}
