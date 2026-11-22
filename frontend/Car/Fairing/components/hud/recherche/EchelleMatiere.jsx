// Section « L'échelle complète » de l'onglet « Théorie quantique » : les neuf niveaux de la matière, de la particule à
// l'Univers, en trois groupes. Chaque niveau montre son objet de référence (taille et masse calculées), sa place sur
// l'échelle logarithmique complète, et — aux niveaux 5 et 6 — la séparation entre matière inerte et matière vivante.
// Composants du kit d'interface.
// Importe les conversions des valeurs de style calculées au rendu.
import { tok } from '@/Fairing/kit/sx';
// Données et calculs de l'échelle.
import { ANALOGIES, ECHELONS, GROUPES, NIVEAUX, dispersionAnalogie, etendue, placeSurEchelle } from './echelleMatiere.js';
// Briques de style communes de la fenêtre Node.
import { Carte, Chiffre, Etiquette, Fiche, GrilleChiffres, Note, SousTitre } from '../node/nodeUi.jsx';
// Écriture scientifique française.
import { scientific } from '@/Engine/AstreSolideEngine/BodyEngine/planetData';

// Couleur de chaque groupe, prise dans le thème : cyan pour l'atome, menthe pour la matière, violet pour le cosmos.
const COULEUR = { atomique: 'info.main', matiere: 'success.main', cosmique: 'secondary.main' };
// Couleur et libellé des deux branches de la matière.
const BRANCHE = { inerte: { couleur: 'text.secondary', nom: 'Branche inerte' }, vivante: { couleur: 'success.main', nom: 'Branche vivante' } };

/** Taille et masse d'un objet, écrites côte à côte : « 1,06 × 10⁻¹⁰ m · 1,67 × 10⁻²⁷ kg ». */
// mesures : compose ce texte.
const mesures = (o) => `${scientific(o.taille, 2)} m · ${scientific(o.masse, 2)} kg`;

/**
 * Règle logarithmique : toute l'échelle (du proton à l'Univers) sur une barre, avec un repère à la place de l'objet.
 * Purement illustrative : la valeur exacte est écrite à côté.
 */
// Déclare Regle : la taille à placer et la couleur du repère.
function Regle({ taille, couleur }) {
  // Place de l'objet sur l'échelle, de 0 à 100 %.
  const place = Math.min(Math.max(placeSurEchelle(taille), 0), 1) * 100;
  // Début du rendu.
  return (
    // La barre, masquée aux lecteurs d'écran (la valeur est déjà dite en texte).
    <div aria-hidden="true" className="relative h-1.5 mt-2 rounded-[24px] bg-line">
      {/* La partie parcourue depuis le proton. */}
      <div className="absolute left-0 top-0 bottom-0 rounded-[24px] opacity-35" style={{ width: `${place}%`, backgroundColor: tok(couleur) }} />
      {/* Le repère de l'objet. */}
      <div className="absolute -top-0.75 w-3 h-3 rounded-full border-2 border-surface" style={{ left: `clamp(0px, calc(${place}% - 6px), calc(100% - 12px))`, backgroundColor: tok(couleur) }} />
    </div>
  );
// Fin de Regle.
}

/** Objet de référence d'un niveau (ou d'une branche) : nom, mesures, formule et règle. */
// Déclare Objet : l'objet, la couleur de sa règle et un titre facultatif.
function Objet({ objet, couleur, titre }) {
  // Début du rendu.
  return (
    // Bloc de l'objet.
    <div className="min-w-0">
      {/* Le titre de la branche, s'il y en a un. */}
      {titre && <span className="t-caption block font-bold mb-0.5" style={{ color: tok(couleur) }}>{titre}</span>}
      {/* Le nom de l'objet et ses mesures. */}
      <p className="t-body2 tabular-nums">
        <strong>{objet.nom}</strong>
        <span className="text-soft"> — {mesures(objet)}</span>
      </p>
      {/* La formule du calcul. */}
      <span className="t-caption text-soft block font-mono text-[0.7rem] mt-0.5 [overflow-wrap:anywhere]">{objet.calcul}</span>
      {/* La place sur l'échelle complète. */}
      <Regle taille={objet.taille} couleur={couleur} />
    </div>
  );
// Fin de Objet.
}

/** Un niveau de l'échelle : rang, nom, analogie cosmique, texte, objet(s) de référence et exemples. */
// Déclare Niveau : le niveau et la couleur de son groupe.
function Niveau({ niveau, couleur }) {
  // Début du rendu.
  return (
    // Élément de liste : le rang à gauche, le contenu à droite.
    <li className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-2.5 py-3 border-t border-line first-of-type:border-t-0 first-of-type:pt-1">
      {/* Le rang, dans un disque de la couleur du groupe. */}
      <div aria-hidden="true" className="w-7 h-7 rounded-full border-2 grid place-items-center font-mono text-[0.8rem] font-bold" style={{ borderColor: tok(couleur), color: tok(couleur) }}>
        {niveau.rang}
      </div>
      {/* Le contenu du niveau. */}
      <div className="min-w-0">
        {/* Le nom, et l'analogie cosmique en étiquette. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h5 className="t-subtitle2 font-bold">
            <span className="absolute w-full h-full overflow-hidden [clip:rect(0_0_0_0)]">Niveau {niveau.rang} : </span>
            {niveau.nom}
          </h5>
          {niveau.cosmique && <Etiquette couleur={couleur}>↔ {niveau.cosmique}</Etiquette>}
        </div>
        {/* La description du niveau. */}
        <p className="t-body2 text-soft mt-0.5 mb-2 max-w-[72ch]">{niveau.texte}</p>
        {/* Niveau à deux branches : inerte et vivante côte à côte ; sinon l'objet de référence seul. */}
        {niveau.branches ? (
          <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[1fr_1fr] gap-2">
            {niveau.branches.map((b) => (
              <Carte key={b.branche} accent={BRANCHE[b.branche].couleur} className="p-2.5 bg-transparent">
                <Objet objet={b} couleur={BRANCHE[b.branche].couleur} titre={`${BRANCHE[b.branche].nom} · ${b.titre}`} />
              </Carte>
            ))}
          </div>
        ) : (
          <Objet objet={niveau.reference} couleur={couleur} />
        )}
        {/* L'objet cosmique associé par l'analogie (niveaux 1 à 3). */}
        {niveau.analogie && (
          <span className="t-caption text-soft block mt-2 tabular-nums">
            Dans l’analogie : <strong>{niveau.analogie.nom}</strong> — {mesures(niveau.analogie)}
          </span>
        )}
        {/* Les autres exemples du niveau. */}
        {niveau.exemples.length > 0 && (
          <span className="t-caption text-soft block mt-1.5">{niveau.exemples.join(' · ')}</span>
        )}
      </div>
    </li>
  );
// Fin de Niveau.
}

/** Section complète : chiffres clés, les trois groupes de niveaux, les sauts d'un niveau au suivant, l'analogie chiffrée. */
// Déclare et exporte EchelleMatiere.
export function EchelleMatiere() {
  // Étendue totale de l'échelle, en ordres de grandeur.
  const span = etendue();
  // Place de l'être humain sur l'échelle, en pourcentage.
  const humain = placeSurEchelle(NIVEAUX[5].branches[1].taille) * 100;
  // Le plus grand saut entre deux niveaux voisins.
  const plusGrand = ECHELONS.slice(1).reduce((a, b) => (b.saut > a.saut ? b : a));
  // Début du rendu.
  return (
    <div>
      {/* Chiffres clés de l'échelle. */}
      <GrilleChiffres>
        <Chiffre libelle="Du proton à l’Univers, en taille" valeur={`${Math.round(span.taille)} ordres de grandeur`} detail={`de ${scientific(ECHELONS[0].taille, 1)} m à ${scientific(ECHELONS[8].taille, 1)} m`} />
        <Chiffre libelle="Du proton à l’Univers, en masse" valeur={`${Math.round(span.masse)} ordres de grandeur`} detail={`de ${scientific(ECHELONS[0].masse, 1)} kg à ${scientific(ECHELONS[8].masse, 1)} kg`} />
        <Chiffre libelle="Place de l’être humain" valeur={`${humain.toFixed(0)} % de l’échelle`} detail="en échelle logarithmique : plus près de l’atome que de l’Univers" />
        <Chiffre libelle="Plus grand saut" valeur={`× 10${String(Math.round(plusGrand.saut)).replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c])}`} detail={`vers le niveau ${plusGrand.rang} (${plusGrand.nom.toLowerCase()})`} />
      </GrilleChiffres>

      {/* Les trois groupes, chacun avec ses trois niveaux. */}
      {GROUPES.map((g, i) => (
        <Carte key={g.id} accent={COULEUR[g.id]} className="mt-3 bg-transparent">
          {/* Le titre du groupe et son sous-titre. */}
          <h4 className="t-subtitle1 font-bold leading-[1.3]">
            <span className="font-mono mr-2" style={{ color: tok(COULEUR[g.id]) }}>{i + 1}.</span>
            {g.titre}
          </h4>
          <span className="t-caption block font-semibold mb-1" style={{ color: tok(COULEUR[g.id]) }}>{g.sousTitre}</span>
          {/* La liste des niveaux du groupe. */}
          <ol className="list-none m-0 p-0">
            {NIVEAUX.filter((n) => n.groupe === g.id).map((n) => <Niveau key={n.rang} niveau={n} couleur={COULEUR[g.id]} />)}
          </ol>
        </Carte>
      ))}
      <Note>
        Sur chaque barre, le repère donne la place de l’objet entre le proton (à gauche) et l’Univers observable (à droite),
        en échelle logarithmique : une graduation égale multiplie la taille par le même facteur. Les tailles sont des diamètres ;
        tailles et masses sont des ordres de grandeur, calculés avec la formule écrite sous chaque objet.
      </Note>

      {/* Les sauts d'un niveau au suivant. */}
      <SousTitre>D’un niveau au suivant</SousTitre>
      <Fiche
        label="Taille, masse et saut de taille de chaque niveau"
        colonnes={[{ titre: 'Niveau' }, { titre: 'Objet', cache: true }, { titre: 'Taille (m)', align: 'right' }, { titre: 'Masse (kg)', align: 'right', cache: true }, { titre: 'Saut', align: 'right' }]}
        lignes={ECHELONS.map((e) => [
          `${e.rang}. ${e.nom}`, e.objet, scientific(e.taille, 2), scientific(e.masse, 2),
          e.facteur ? `× ${scientific(e.facteur, 1)}` : '—',
        ])}
      />

      {/* L'analogie cosmique, chiffrée. */}
      <SousTitre>L’analogie cosmique en nombres</SousTitre>
      <Fiche
        label="Facteurs d’agrandissement de l’analogie cosmique"
        colonnes={[{ titre: 'Niveau' }, { titre: 'Objet réel' }, { titre: 'Objet cosmique' }, { titre: 'Taille ×', align: 'right' }, { titre: 'Masse ×', align: 'right', cache: true }]}
        lignes={ANALOGIES.map((a) => [a.rang, a.reel, a.cosmique, scientific(a.facteurTaille, 1), scientific(a.facteurMasse, 1)])}
      />
      <Note>
        Si l’analogie était une maquette exacte, le facteur d’agrandissement serait le même aux trois niveaux. En taille, il
        varie d’un rapport {Math.round(dispersionAnalogie()).toLocaleString('fr-FR')} : le système solaire est proportionnellement
        dix fois plus « plein » qu’un atome, et les étoiles sont bien plus écartées que les atomes d’une molécule. En masse, le
        facteur est presque le même pour le proton et pour l’atome (≈ {scientific(ANALOGIES[0].facteurMasse, 2)}) : c’est
        simplement le nombre de nucléons que contient le Soleil.
      </Note>
    </div>
  );
// Fin de EchelleMatiere.
}
