// Section « Charge électrique du Soleil selon sa température » de l'onglet « Théorie quantique » : la charge nette
// (minuscule) et la charge ionisée totale (immense, mais équilibrée), avec les formules et les valeurs calculées.
// Composants MUI.
import { Box } from '@mui/material';
// Calculs de la charge du Soleil.
import { CONSTANTES, LIGNES_SYNTHESE, SEUIL_IONISATION, qCouronne, qIonisee, qNette, rapportVitesses, tauxIonisation } from './chargeSoleil.js';
// Briques de style communes de la fenêtre Node.
import { Chiffre, Fiche, Formule, GrilleChiffres, MONO, Note, Precision, SousTitre } from '../node/nodeUi.jsx';
// Écriture scientifique française.
import { scientific } from '@/Engine/AstreSolideEngine/BodyEngine/planetData';

// virgule : écrit un nombre avec une virgule décimale.
const virgule = (n, d = 2) => n.toFixed(d).replace('.', ',');
// milliers : écrit un entier avec des espaces entre les milliers.
const milliers = (n) => Math.round(n).toLocaleString('fr-FR');

/** Section complète : chiffres clés, les trois calculs, le seuil d'ionisation et la synthèse. */
// Déclare et exporte ChargeSoleil.
export function ChargeSoleil() {
  // Charge ionisée du Soleil entièrement ionisé.
  const q = qIonisee();
  // Début du rendu.
  return (
    <Box>
      {/* Chiffres clés. */}
      <GrilleChiffres>
        <Chiffre libelle="Charge nette statique" valeur={`+${qNette().toFixed(0)} C`} detail="indépendante de la température" />
        <Chiffre libelle="Charge nette coronale" valeur={`+${qCouronne(CONSTANTES.T_COURONNE).toFixed(0)} C`} detail="à 1,5 × 10⁶ K, proportionnelle à T" />
        <Chiffre libelle="Charge ionisée totale" valeur={`± ${scientific(q, 2)} C`} detail="protons d’un côté, électrons de l’autre" />
        <Chiffre libelle="Déséquilibre" valeur={`1 pour ${scientific(q / qNette(), 1)}`} detail="une charge en excès sur ce nombre de charges" />
      </GrilleChiffres>
      <Note>
        Deux réalités à ne pas confondre. La <strong>charge ionisée</strong> : la chaleur arrache leurs électrons à
        l’hydrogène et à l’hélium, ce qui libère des charges +Q et −Q qui s’équilibrent presque parfaitement. La{' '}
        <strong>charge nette</strong> : à même température, les électrons sont {milliers(CONSTANTES.mP / CONSTANTES.mE)} fois
        plus légers que les protons, donc {virgule(rapportVitesses(), 0)} fois plus rapides, et tendent à s’échapper ; un
        champ électrique radial les retient, et le Soleil garde un très léger excès de charges positives.
      </Note>

      <SousTitre>1 · Charge nette statique — indépendante de T</SousTitre>
      <Formule>{'Q_nette = 2π ε₀ G (m_p − m_e) M☉ / e'}</Formule>
      <Note>
        = <strong>+{virgule(qNette(), 1)} C</strong>, avec M☉ = {scientific(CONSTANTES.M_SOL, 4)} kg et m_p ={' '}
        {scientific(CONSTANTES.mP, 4)} kg. Le champ électrique porte la moitié de la différence de poids entre un proton et un
        électron (équilibre de Pannekoek-Rosseland).
      </Note>

      <SousTitre>2 · Charge nette coronale — proportionnelle à T</SousTitre>
      <Formule>{'Q_couronne = 4π ε₀ R☉ k_B T / e'}</Formule>
      <Note>
        = <strong>+{virgule(qCouronne(CONSTANTES.T_COURONNE), 1)} C</strong> à T = 1,5 × 10⁶ K (couronne), soit{' '}
        {scientific(qCouronne(1000), 2)} C par millier de kelvins : le potentiel qui retient les électrons vaut environ k_B T / e.
      </Note>

      <SousTitre>3 · Charge ionisée — équation de Saha</SousTitre>
      <Formule>{'x² / (1 − x) = (1/n) · (2π m_e k_B T / h²)^(3/2) · exp(−χ_H / k_B T)\nQ₊ = x · e · (M☉/m_p) · (X + Y/2 + Z/2)     et −Q₊ pour les électrons'}</Formule>
      <Fiche
        label="Taux d’ionisation de l’hydrogène selon la température, à la densité de la photosphère"
        sx={{ mt: 1, maxWidth: 420 }}
        colonnes={[{ titre: 'Température (K)' }, { titre: 'Taux d’ionisation x', align: 'right' }]}
        lignes={SEUIL_IONISATION.map(([T, x]) => [milliers(T), x < 0.01 ? scientific(x, 1) : virgule(x, 3)])}
      />
      <Note>
        x est la part d’atomes d’hydrogène ionisés ; il dépend de la température et de la densité n (ici n = 10²³ m⁻³, celle
        de la photosphère). À la surface (5 772 K), x ≈ {scientific(tauxIonisation(CONSTANTES.T_PHOTOSPHERE), 1)} : le gaz est
        presque neutre. Le seuil est franchi entre 10 000 et 20 000 K. Dans l’intérieur, où se trouve presque toute la masse,
        l’ionisation est totale (x = 1), d’où Q₊ = <strong>+{scientific(q, 3)} C</strong>.
      </Note>

      <SousTitre>Synthèse</SousTitre>
      <Fiche
        label="Synthèse des trois charges du Soleil"
        fixe
        colonnes={[{ titre: 'Grandeur', largeur: '34%' }, { titre: 'Formule', cache: true, sx: { fontFamily: MONO, fontSize: '0.75rem' } }, { titre: 'Valeur', align: 'right', largeur: '34%' }]}
        lignes={LIGNES_SYNTHESE.map((l) => [
          l.grandeur, l.formule,
          <Box key={l.grandeur}><strong>{l.valeur > 1e6 ? scientific(l.valeur, 3) : virgule(l.valeur, 1)} {l.unite}</strong><Precision>{l.note}</Precision></Box>,
        ])}
      />
      <Note>
        La charge ionisée totale est immense mais s’équilibre ; la charge nette n’est que de quelques dizaines de coulombs.
        Le Soleil est donc quasi neutre — au contraire d’un noyau d’atome, dont toute la charge est positive : c’est une
        différence de fond avec le « noyau » de la théorie.
      </Note>
    </Box>
  );
// Fin de ChargeSoleil.
}
