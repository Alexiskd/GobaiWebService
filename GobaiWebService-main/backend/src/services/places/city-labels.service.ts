// Outils NestJS : erreur 502, injection par jeton, service injectable.
import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
// Jeton d'injection de la configuration.
import { APP_CONFIG } from '../../modules/config.module';
// Type (effacé à la compilation) de la configuration.
import type { AppConfig } from '../../common/configuration';
// Type (effacé à la compilation) de la réponse.
import type { CityLabelsDto } from '../../dto/places.dto';
// Fonction de chargement d'un JSON (fichier ou adresse).
import { loadJson } from '../../common/local-source';

// Délai maximal du chargement : 45 secondes.
const TIMEOUT_MS = 45_000;   // le GeoJSON complet pèse ≈ 19 Mo
// Fonction round : arrondit à 4 décimales (environ 10 m).
const round = (v: number) => Math.round(v * 10000) / 10000;
/** Villes classées : les 5000 plus peuplées (Natural Earth `pop_max`). */
// Nombre de villes qui reçoivent un rang mondial.
const WORLD_RANK_MAX = 5000;

// Écriture dominante de chaque pays (ISO A2) et champ Natural Earth correspondant. Les pays absents
// restent en caractères latins : soit l'écriture est latine, soit Natural Earth ne fournit pas le nom
// local (thaï, tamoul, géorgien, amharique, khmer…). Le persan et l'ourdou s'écrivent en arabe.
// Écritures locales : pour chaque champ de Natural Earth, le nom de l'écriture et les pays concernés :
const LOCAL_SCRIPTS: { field: string; script: string; countries: string[] }[] = [
  // japonais : Japon ;
  { field: 'NAME_JA', script: 'japanese', countries: ['JP'] },
  // coréen : les deux Corées ;
  { field: 'NAME_KO', script: 'korean', countries: ['KR', 'KP'] },
  // chinois simplifié : Chine ;
  { field: 'NAME_ZH', script: 'chinese', countries: ['CN'] },
  // chinois traditionnel : Taïwan, Hong Kong, Macao ;
  { field: 'NAME_ZHT', script: 'chinese', countries: ['TW', 'HK', 'MO'] },
  // arabe : les pays suivants,
  { field: 'NAME_AR', script: 'arabic', countries: [
    // première partie de la liste ;
    'EG', 'SA', 'AE', 'DZ', 'MA', 'TN', 'LY', 'SD', 'IQ', 'SY', 'JO', 'LB', 'KW', 'QA', 'BH',
    // seconde partie de la liste.
    'OM', 'YE', 'MR', 'PS', 'EH', 'DJ', 'SO', 'KM',
  // Fin de la liste des pays arabes.
  ] },
  // persan, écrit en arabe : Iran, Afghanistan ;
  { field: 'NAME_FA', script: 'arabic', countries: ['IR', 'AF'] },
  // ourdou, écrit en arabe : Pakistan ;
  { field: 'NAME_UR', script: 'arabic', countries: ['PK'] },
  // hébreu : Israël ;
  { field: 'NAME_HE', script: 'hebrew', countries: ['IL'] },
  // hindi (devanagari) : Inde ;
  { field: 'NAME_HI', script: 'devanagari', countries: ['IN'] },
  // bengali : Bangladesh ;
  { field: 'NAME_BN', script: 'bengali', countries: ['BD'] },
  // grec : Grèce, Chypre ;
  { field: 'NAME_EL', script: 'greek', countries: ['GR', 'CY'] },
  // russe (cyrillique) : Russie ;
  { field: 'NAME_RU', script: 'cyrillic', countries: ['RU'] },
  // ukrainien (cyrillique) : Ukraine.
  { field: 'NAME_UK', script: 'cyrillic', countries: ['UA'] },
// Fin de la liste des écritures.
];
// Table code de pays → champ et écriture, pour une recherche directe.
const SCRIPT_BY_COUNTRY = new Map<string, { field: string; script: string }>();
// Pour chaque écriture,
for (const { field, script, countries } of LOCAL_SCRIPTS) {
  // chacun de ses pays est rangé dans la table.
  for (const iso of countries) SCRIPT_BY_COUNTRY.set(iso, { field, script });
// Fin du remplissage.
}
// Outil de Node qui donne le nom français d'un pays d'après son code.
const COUNTRY_NAMES_FR = new Intl.DisplayNames(['fr'], { type: 'region' });

// Type des propriétés d'un lieu Natural Earth : des champs de type inconnu.
type NeProperties = Record<string, unknown>;

// Forme d'un lieu du fichier Natural Earth.
interface NeFeature {
  // geometry : son type et ses coordonnées.
  geometry?: { type?: string; coordinates?: [number, number] };
  // properties : ses propriétés.
  properties?: NeProperties;
// Fin de NeFeature.
}

/**
 * Noms des villes du monde entier (Natural Earth 1:10m « populated places », domaine public, ≈ 7 300 lieux),
 * triés de la plus peuplée à la moins peuplée : le client les affiche dans cet ordre en évitant les chevauchements,
 * donc les grandes villes de loin et de plus en plus de villes en zoomant.
 * Chaque lieu porte aussi son nom dans l'écriture locale (`native`) quand Natural Earth le fournit, avec un
 * identifiant d'écriture (`script`) pour que le client choisisse la police et la taille adaptées.
 * Fichier importé dans le projet (backend/data/vendor/natural-earth), lu une fois puis gardé en mémoire ;
 * en cas d'échec, l'appel suivant réessaie.
 */
// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service des noms de villes.
export class CityLabelsService {
  // Réponse gardée en mémoire : une promesse, ou null.
  private cache: Promise<CityLabelsDto> | null = null;

  // Constructeur ; ses paramètres :
  constructor(
    // la configuration, demandée par son jeton ;
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    // la fonction de téléchargement, fetch par défaut.
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  // Corps du constructeur vide.
  ) {}

  // Méthode get.
  get(): Promise<CityLabelsDto> {
    // Rien en mémoire : lance le chargement et garde sa promesse ; en cas d'échec, on l'oublie et l'erreur est transmise.
    if (!this.cache) this.cache = this.load().catch((e) => { this.cache = null; throw e; });
    // Renvoie la promesse.
    return this.cache;
  // Fin de get.
  }

  // Méthode privée load.
  private async load(): Promise<CityLabelsDto> {
    // Fichier ou adresse des villes.
    const url = this.config.cityLabels.sourceUrl;
    // Contenu à lire : une liste de lieux.
    let body: { features?: NeFeature[] };
    // Essaie
    try {
      // de le charger ;
      body = await loadJson<{ features?: NeFeature[] }>(url, this.fetchFn, TIMEOUT_MS);
    // en cas d'échec,
    } catch (e) {
      // erreur 502 qui cite la source et la cause.
      throw new BadGatewayException(`Noms des villes indisponibles (${url}) : ${(e as Error).message}`);
    // Fin du cas.
    }
    // À partir des lieux (aucun si la liste manque) :
    const items = (body.features ?? [])
      // garde ceux qui sont des points avec des coordonnées ;
      .filter((f) => f.geometry?.type === 'Point' && Array.isArray(f.geometry.coordinates))
      // transforme chacun :
      .map((f) => {
        // ses propriétés ;
        const p = f.properties ?? {};
        // sa longitude et sa latitude ;
        const [lon, lat] = f.geometry!.coordinates!;
        // son nom, ou son nom sans accents à défaut ;
        const name = String(p.NAME || p.NAMEASCII || '');
        // le code de son pays, en majuscules ;
        const iso = String(p.ISO_A2 || '').toUpperCase();
        // l'écriture locale de ce pays, si elle est connue ;
        const script = SCRIPT_BY_COUNTRY.get(iso);
        // son nom dans cette écriture, s'il existe ;
        const local = script ? String(p[script.field] ?? '').trim() : '';
        // le nom de son pays ;
        const country = String(p.ADM0NAME || '');
        // le nom français du pays, si le code a bien deux lettres ;
        const countryFr = /^[A-Z]{2}$/.test(iso) ? COUNTRY_NAMES_FR.of(iso) : undefined;
        // son nom français ;
        const nameFr = String(p.NAME_FR || '').trim();
        // sa région ;
        const region = String(p.ADM1NAME || '').trim();
        // son fuseau horaire ;
        const timezone = String(p.TIMEZONE || '').trim();
        // la surface de son aire urbaine, entière et jamais négative.
        const areaKm2 = Math.max(0, Math.round(Number(p.MAX_AREAKM) || 0));
        // Objet de la ville :
        return {
          // son nom ;
          name,
          // son nom français, seulement s'il diffère ;
          ...(nameFr && nameFr !== name ? { nameFr } : {}),
          // son pays ;
          country,
          // le nom français du pays, seulement s'il diffère ;
          ...(countryFr && countryFr !== country ? { countryFr } : {}),
          // sa région, seulement si elle ne répète pas le nom de la ville ;
          ...(region && region !== name ? { region } : {}),
          // son fuseau horaire, s'il est connu ;
          ...(timezone ? { timezone } : {}),
          // sa surface, si elle est connue ;
          ...(areaKm2 ? { areaKm2 } : {}),
          // sa longitude arrondie ;
          lon: round(lon),
          // sa latitude arrondie ;
          lat: round(lat),
          // sa population, entière et jamais négative ;
          pop: Math.max(0, Math.round(Number(p.POP_MAX) || 0)),
          // capitale d'État ou non ;
          capital: p.ADM0CAP === 1,
          // son nom local et son écriture, seulement s'ils existent et diffèrent du nom latin.
          ...(script && local && local !== name ? { native: local, script: script.script } : {}),
        // Fin de l'objet.
        };
      // Fin de la transformation.
      })
      // Retire les villes sans nom ou sans coordonnées valides.
      .filter((c) => c.name && Number.isFinite(c.lon) && Number.isFinite(c.lat))
      // Capitales d'abord à population égale, puis par population décroissante.
      // Trie par population décroissante ; à population égale, la capitale d'abord.
      .sort((a, b) => b.pop - a.pop || Number(b.capital) - Number(a.capital));
    // Rang mondial (top 5000) : par population d'agglomération, un seul rang par couple nom + pays.
    // Couples nom + pays déjà classés.
    const seen = new Set<string>();
    // Dernier rang attribué.
    let rank = 0;
    // Parcourt les villes, de la plus peuplée à la moins peuplée :
    for (const c of items as (typeof items[number] & { rank?: number })[]) {
      // on s'arrête au 5 000e rang, ou à la première ville sans population ;
      if (rank >= WORLD_RANK_MAX || c.pop <= 0) break;
      // clé de la ville : nom et pays ;
      const key = `${c.name}|${c.country}`;
      // déjà classée : on passe ;
      if (seen.has(key)) continue;
      // on la note,
      seen.add(key);
      // et elle reçoit le rang suivant.
      c.rank = ++rank;
    // Fin de la boucle.
    }
    // Renvoie la source, la mention, le nombre de villes et les villes.
    return { source: 'Natural Earth 1:10m populated places', attribution: 'Villes : Natural Earth', count: items.length, items };
  // Fin de load.
  }
// Fin du service.
}
