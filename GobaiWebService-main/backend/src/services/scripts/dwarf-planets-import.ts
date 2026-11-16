/**
 * Importe les planètes naines depuis JPL Horizons et réécrit services/data/dwarf-planets.data.ts.
 *
 *   npm run dwarf:import                       → les cinq planètes naines de l'UAI, éléments à J2000
 *   npm run dwarf:import -- ceres haumea       → seulement celles nommées
 *   npm run dwarf:import -- --epoch 2026-01-01 → à une autre époque
 *
 * Outil serveur, lancé à la main : l'app ne parle jamais à Horizons à l'exécution. Pluton est ignoré par défaut,
 * ses éléments de la table des planètes étant meilleurs (dérives séculaires ajustées sur les observations) ; le
 * nommer explicitement force son import.
 *
 * La requête sort vers ssd.jpl.nasa.gov : le réseau doit l'autoriser, sans quoi le script s'arrête en le disant.
 */
// Charge le fichier .env dans process.env.
import 'dotenv/config';
// writeFile : écrit un fichier en entier, de façon asynchrone.
import { writeFile } from 'node:fs/promises';
// Chemin d'un fichier, construit depuis le dossier de ce script.
import { join } from 'node:path';
// Ouvre l'import du module d'import des planètes naines :
import {
  // la liste des planètes naines, le contrôle de vraisemblance, l'adresse de la requête, la lecture de la réponse et la conversion,
  DWARF_PLANETS, checkHorizonsTarget, horizonsElementsUrl, parseHorizonsElements, toDwarfPlanet,
  // et les types d'une définition et d'une planète importée.
  type DwarfPlanetDef, type ImportedDwarf,
// Fin de l'import.
} from '../bodies/dwarf-planets';

/**
 * Fichier produit : la table des planètes naines, dans les sources. Le script tourne compilé, depuis
 * dist/services/scripts : trois niveaux au-dessus se trouve la racine du backend, puis src/services/data.
 */
// Chemin du fichier produit.
const TARGET = join(__dirname, '..', '..', '..', 'src', 'services', 'data', 'dwarf-planets.data.ts');
/** Délai d'attente d'une réponse d'Horizons : 30 secondes. */
// Délai d'attente : 30 secondes.
const TIMEOUT_MS = 30_000;

/** Demande une planète naine à Horizons, contrôle la réponse et la convertit. */
// Fonction fetchDwarf, asynchrone : reçoit la définition et l'époque.
async function fetchDwarf(def: DwarfPlanetDef, epoch: string): Promise<ImportedDwarf> {
  // Adresse de la requête.
  const url = horizonsElementsUrl(def.horizons, epoch);
  // Réponse d'Horizons, abandonnée au-delà du délai ; une panne de réseau est renvoyée en citant le corps.
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    // Échec : erreur qui nomme le corps et la cause (hôte refusé, délai dépassé…).
    .catch((e: Error) => { throw new Error(`Horizons injoignable pour ${def.nom} : ${e.message}`); });
  // Réponse en erreur : on le dit avec son code.
  if (!res.ok) throw new Error(`Horizons a répondu ${res.status} pour ${def.nom}`);
  // Les éléments lus dans le texte de la réponse.
  const el = parseHorizonsElements(await res.text());
  // Contrôle que la réponse porte bien sur ce corps, et que son orbite est vraisemblable.
  checkHorizonsTarget(def, el);
  // La planète convertie au format de la table.
  return toDwarfPlanet(def, el);
// Fin de fetchDwarf.
}

/** Écrit un nombre tel quel, en gardant tous ses chiffres. */
// Fonction num : reçoit un nombre et le rend en texte.
const num = (v: number): string => String(v);

/** Fabrique le contenu du fichier produit : la table des planètes naines, commentée ligne par ligne. */
// Fonction render : reçoit les planètes importées et l'époque.
function render(dwarfs: ImportedDwarf[], epoch: string): string {
  // Entrées de la table, une par planète.
  const entries = dwarfs.map(({ data, rayonSource }) => [
    // ouverture de l'entrée ;
    '  // Planète naine suivante :', '  {',
    // son nom ;
    `    // son nom, ${data.name} ;`, `    "name": ${JSON.stringify(data.name)},`,
    // son rayon, avec la provenance de la valeur ;
    `    // son rayon, en rayons terrestres (${rayonSource === 'horizons' ? 'mesuré par Horizons' : 'rayon moyen publié, Horizons répond « n.a. »'}) ;`,
    `    "radius": ${num(data.radius)},`,
    // sa rotation ;
    '    // sa période de rotation, en jours ;', `    "rotation": ${num(data.rotation)},`,
    // la marque de planète naine ;
    '    // marque : planète naine ;', '    "dwarf": true,',
    // sa couleur ;
    '    // sa couleur dans l’interface ;', `    "color": ${JSON.stringify(data.color)},`,
    // ses éléments, chacun commenté ;
    `    // les éléments d’orbite de ${data.name} (élément puis dérive par siècle) :`, '    "elements": [',
    '      // demi-grand axe a, en UA ;', `      ${num(data.elements[0])},`,
    '      // dérive de a par siècle : inconnue pour une planète naine ;', `      ${num(data.elements[1])},`,
    '      // excentricité e ;', `      ${num(data.elements[2])},`,
    '      // dérive de e par siècle : inconnue ;', `      ${num(data.elements[3])},`,
    '      // inclinaison I, en degrés ;', `      ${num(data.elements[4])},`,
    '      // dérive de I par siècle : inconnue ;', `      ${num(data.elements[5])},`,
    '      // longitude moyenne L, en degrés (Ω + ω + M à l’époque) ;', `      ${num(data.elements[6])},`,
    '      // dérive de L par siècle : le moyen mouvement d’Horizons sur un siècle julien ;', `      ${num(data.elements[7])},`,
    '      // longitude du périhélie ϖ, en degrés (Ω + ω) ;', `      ${num(data.elements[8])},`,
    '      // dérive de ϖ par siècle : inconnue ;', `      ${num(data.elements[9])},`,
    '      // longitude du nœud ascendant Ω, en degrés ;', `      ${num(data.elements[10])},`,
    '      // dérive de Ω par siècle : inconnue.', `      ${num(data.elements[11])}`,
    // fermeture des éléments et de l'entrée.
    '    // fin des éléments.', '    ]', `  // Fin de ${data.name}.`, '  }',
  // Les entrées sont séparées par une virgule.
  ].join('\n')).join(',\n');
  // Commandes Horizons, pour la table du bas du fichier.
  const codes = DWARF_PLANETS.map((d) => `${d.id}: '${d.horizons}'`).join(', ');
  // Le fichier complet.
  return `/**
 * Planètes naines, importées de JPL Horizons — FICHIER PRODUIT PAR UN SCRIPT, à ne pas modifier à la main.
 *
 * Régénération : \`npm run dwarf:import --prefix backend\` (voir services/scripts/dwarf-planets-import.ts). Le script
 * demande à Horizons les éléments osculateurs de chaque planète naine reconnue par l'UAI, contrôle que la réponse
 * porte bien sur le corps demandé, les convertit au format de la table des planètes et réécrit ce fichier.
 *
 * Les entrées ci-dessous rejoignent PLANETS (voir bodies.data.ts) : l'app les traite donc comme les huit planètes,
 * orbite calculée localement par Kepler, sans jamais interroger Horizons à l'exécution.
 *
 * Époque des éléments : ${epoch}. Pluton n'est pas ici : il est dans la table des planètes depuis l'origine, avec
 * ses dérives séculaires ajustées sur les observations, meilleures que la propagation à deux corps de cet import.
 */
// Type (effacé à la compilation) des données d'une planète.
import type { PlanetData } from './bodies.data';

/** Planètes naines importées, de la plus proche à la plus lointaine du Soleil. */
// Liste des planètes naines :
export const DWARF_PLANETS_DATA: PlanetData[] = [
${entries}
// Fin de la liste.
];

/**
 * Commandes JPL Horizons des planètes naines : le numéro du petit corps suivi d'un point-virgule, qui dit à
 * Horizons de chercher parmi les astéroïdes et les transneptuniens et non parmi les planètes.
 */
// Commande Horizons de chaque planète naine :
export const DWARF_PLANET_HORIZONS: Record<string, string> = {
  // Cérès (1), Pluton (134340), Haumea (136108), Makemake (136472), Éris (136199).
  ${codes},
// Fin de la table.
};
`;
// Fin de render.
}

// Fonction principale du script.
async function main() {
  // Arguments de la ligne de commande.
  const args = process.argv.slice(2);
  // Position de l'option d'époque.
  const iEpoch = args.indexOf('--epoch');
  // Époque demandée, J2000 par défaut.
  const epoch = iEpoch >= 0 ? `${args[iEpoch + 1]} 12:00` : '2000-01-01 12:00';
  // Noms demandés : les arguments qui ne sont pas l'option d'époque ni sa valeur.
  const named = args.filter((a, k) => !a.startsWith('--') && k !== iEpoch + 1).map((a) => a.toLowerCase());
  // Planètes à importer : celles nommées, sinon toutes sauf Pluton.
  const wanted = named.length ? DWARF_PLANETS.filter((d) => named.includes(d.id)) : DWARF_PLANETS.filter((d) => d.id !== 'pluto');
  // Aucune reconnue : on le dit avec la liste des identifiants possibles.
  if (!wanted.length) throw new Error(`aucune planète naine reconnue dans « ${named.join(' ')} » ; possibles : ${DWARF_PLANETS.map((d) => d.id).join(', ')}`);
  // Les planètes importées.
  const done: ImportedDwarf[] = [];
  // Les échecs, par planète.
  const failed: string[] = [];
  // Pour chaque planète demandée (une à la fois : Horizons n'aime pas les requêtes en rafale).
  for (const def of wanted) {
    // Essai (début).
    try {
      // La demande à Horizons, contrôlée et convertie.
      const dwarf = await fetchDwarf(def, epoch);
      // Ajoutée à la liste.
      done.push(dwarf);
      // Bilan de cette planète : son demi-grand axe, sa période et la provenance de son rayon.
      console.log(`${def.nom} : a = ${dwarf.data.elements[0].toFixed(4)} UA, période ${(dwarf.data.elements[0] ** 1.5).toFixed(1)} ans, rayon ${dwarf.rayonSource}`);
    // En cas d'échec (début).
    } catch (e) {
      // Note l'échec et l'affiche, sans arrêter les autres.
      failed.push(`${def.nom} : ${(e as Error).message}`);
      // Message d'erreur de cette planète.
      console.error(`échec ${def.nom} : ${(e as Error).message}`);
    // Fin de l'essai.
    }
  // Fin de la boucle.
  }
  // Aucune planète importée : rien n'est écrit, le fichier en place est conservé.
  if (!done.length) throw new Error(`aucune planète naine importée ; le fichier n’est pas réécrit.\n${failed.join('\n')}`);
  // Classe les planètes par demi-grand axe croissant, comme la table des planètes.
  done.sort((a, b) => a.data.elements[0] - b.data.elements[0]);
  // Écrit le fichier produit.
  await writeFile(TARGET, render(done, epoch), 'utf8');
  // Bilan : le nombre de planètes écrites et le fichier.
  console.log(`${done.length} planète(s) naine(s) → ${TARGET}`);
  // S'il y a eu des échecs : les rappeler, car le fichier ne contient que les réussites.
  if (failed.length) console.warn(`${failed.length} échec(s) ; ces planètes ne sont pas dans le fichier :\n${failed.join('\n')}`);
// Fin de main.
}

// Lance le script ; en cas d'erreur :
main().catch((e) => {
  // affiche son message ;
  console.error((e as Error).message);
  // et fixe le code de sortie à 1, sans couper le processus.
  process.exitCode = 1;
// Fin du traitement d'erreur.
});
