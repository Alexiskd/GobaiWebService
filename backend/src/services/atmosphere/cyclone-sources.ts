// Importe le contrôle des coordonnées.
import { isLonLat } from './atmospheric-event';
// Importe la conversion du vent en nœuds.
import { toKnots } from './eonet';

// Lecture des positions courantes des cyclones (sans NestJS, donc testable seule) :
//  - NOAA NHC (CurrentStorms.json) : Atlantique, Pacifique Est et Central ; vent soutenu (nœuds), pression (hPa) ;
//  - GDACS (ONU · Commission européenne) : monde entier ; vent maximal (km/h), niveau d'alerte, agence d'origine.
// Chaque lecture devient un « relevé » (CycloneFix) : la position du centre à une heure donnée, chez un fournisseur.

// Type Row : un objet aux champs de type inconnu.
type Row = Record<string, unknown>;
// str : la valeur si c'est un texte non vide, sinon null.
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
// num : la valeur si c'est un nombre fini (ou un texte qui en est un), sinon null.
const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/** Relevé de la position courante d'un cyclone chez un fournisseur. */
// Forme d'un relevé.
export interface CycloneFix {
  // provider : le fournisseur (providers.ts).
  provider: string;
  // key : l'identifiant chez le fournisseur.
  key: string;
  // name : le nom publié.
  name: string;
  // lon, lat : position du centre, en degrés.
  lon: number; lat: number;
  // t : heure du relevé, en millisecondes UTC.
  t: number;
  // windKt : vent soutenu, en nœuds, ou null.
  windKt: number | null;
  // pressureMb : pression au centre, en hectopascals, ou null.
  pressureMb: number | null;
  // classification : la classe publiée (HU, TS, « Tropical Depression »…), ou null.
  classification: string | null;
  // alertLevel : le niveau d'alerte GDACS (Green, Orange, Red), ou null.
  alertLevel: string | null;
  // agency : l'agence d'origine de la mesure (NOAA, JTWC…), ou null.
  agency: string | null;
  // url : la fiche publique, ou null.
  url: string | null;
// Fin de CycloneFix.
}

/** Coordonnée NHC écrite « 28.7N » ou « 65.0W » : nombre signé (sud et ouest négatifs) ; null si illisible. */
// Fonction parseHemisphere : le texte.
export function parseHemisphere(text: unknown): number | null {
  // Nombre suivi d'une lettre d'hémisphère.
  const m = /^\s*(\d+(?:\.\d+)?)\s*([NSEW])\s*$/i.exec(String(text ?? ''));
  // Illisible : null.
  if (!m) return null;
  // Valeur absolue.
  const v = Number(m[1]);
  // Sud et ouest : négatif.
  return /[SW]/i.test(m[2]) ? -v : v;
// Fin de parseHemisphere.
}

/** Heure « AAAA-MM-JJTHH:MM:SS » sans fuseau : lue en UTC (GDACS publie en UTC). NaN si illisible. */
// Fonction parseUtc : le texte.
export function parseUtc(text: unknown): number {
  // Texte de l'heure.
  const s = str(text);
  // Absent : NaN.
  if (!s) return NaN;
  // Fuseau présent (Z ou ±HH:MM) : lu tel quel ; sinon UTC.
  return Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}Z`);
// Fin de parseUtc.
}

/** Cyclones actifs du NHC. */
// Fonction parseNhcStorms : la réponse.
export function parseNhcStorms(json: unknown): CycloneFix[] {
  // Liste des cyclones actifs.
  const storms = (json as Row | null)?.activeStorms;
  // Pas une liste : aucun.
  if (!Array.isArray(storms)) return [];
  // Relevés lus.
  const out: CycloneFix[] = [];
  // Pour chaque cyclone :
  for (const s of storms as Row[]) {
    // identifiant et nom ;
    const key = str(s?.id), name = str(s?.name);
    // position : champs numériques, sinon textes « 28.7N » / « 65.0W » ;
    const lat = num(s?.latitudeNumeric) ?? parseHemisphere(s?.latitude), lon = num(s?.longitudeNumeric) ?? parseHemisphere(s?.longitude);
    // heure de la dernière mise à jour ;
    const t = Date.parse(str(s?.lastUpdate) ?? '');
    // incomplet ou hors du globe : ignoré ;
    if (!key || !name || !isLonLat(lon, lat) || !Number.isFinite(t)) continue;
    // fiche de l'avis public ;
    const advisory = s.publicAdvisory as Row | undefined;
    // relevé : vent en nœuds (« intensity »), pression en hPa.
    out.push({ provider: 'nhc', key, name, lon: lon as number, lat: lat as number, t, windKt: toKnots(s.intensity, 'kt'), pressureMb: num(s.pressure), classification: str(s.classification), alertLevel: null, agency: 'NHC', url: str(advisory?.url) ?? 'https://www.nhc.noaa.gov/' });
  // Fin de la boucle.
  }
  // Renvoie les relevés.
  return out;
// Fin de parseNhcStorms.
}

/** Cyclones en cours selon GDACS (seuls les événements marqués « courants »). */
// Fonction parseGdacsCyclones : la réponse GeoJSON.
export function parseGdacsCyclones(json: unknown): CycloneFix[] {
  // Entités de la collection.
  const features = (json as Row | null)?.features;
  // Pas une liste : aucun.
  if (!Array.isArray(features)) return [];
  // Relevés lus.
  const out: CycloneFix[] = [];
  // Pour chaque entité :
  for (const f of features as Row[]) {
    // ses propriétés ;
    const p = (f?.properties ?? {}) as Row;
    // pas un cyclone, ou plus en cours : ignorée ;
    if (p.eventtype !== 'TC' || String(p.iscurrent).toLowerCase() !== 'true') continue;
    // position du point ;
    const c = (f.geometry as Row | undefined)?.type === 'Point' ? ((f.geometry as Row).coordinates as unknown[]) : null;
    // longitude et latitude ;
    const lon = num(c?.[0]), lat = num(c?.[1]);
    // heure : fin de l'épisode (dernier bulletin), sinon dernière modification ;
    const t = Number.isFinite(parseUtc(p.todate)) ? parseUtc(p.todate) : parseUtc(p.datemodified);
    // identifiant, nom court (« PENA-26 ») ;
    const key = num(p.eventid), short = str(p.eventname) ?? str(p.name);
    // incomplet : ignoré ;
    if (key === null || !short || !isLonLat(lon, lat) || !Number.isFinite(t)) continue;
    // sévérité : vent maximal et son unité ;
    const sev = (p.severitydata ?? {}) as Row;
    // adresses de la fiche ;
    const url = (p.url ?? {}) as Row;
    // relevé.
    out.push({ provider: 'gdacs', key: String(key), name: short, lon: lon as number, lat: lat as number, t, windKt: toKnots(sev.severity, sev.severityunit), pressureMb: null, classification: str(sev.severitytext), alertLevel: str(p.alertlevel), agency: str(p.source), url: str(url.report) ?? `https://www.gdacs.org/report.aspx?eventtype=TC&eventid=${key}` });
  // Fin de la boucle.
  }
  // Renvoie les relevés.
  return out;
// Fin de parseGdacsCyclones.
}
