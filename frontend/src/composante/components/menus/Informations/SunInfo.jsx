// Importe de React les crochets useEffect, useMemo et useState.
import { useEffect, useMemo, useState } from 'react';
// Importe de MUI Box, Chip, Stack, les éléments de tableau et Typography.
import { Box, Chip, Stack, Table, TableBody, TableCell, TableRow, Typography } from '@mui/material';
// Importe le chargement de l'activité solaire et celui des régions actives.
import { fetchSolarActivity, fetchSolarRegions } from '@/moteur/api/scene';
// Importe le libellé de l'indice Kp, les prochains apsides, les prochaines saisons et les grandeurs du Soleil en direct.
import { kpLabel, nextApsides, nextSeasons, sunLive } from '@/moteur/engine/sunMath';

// Carte d'identité (valeurs de référence UAI / NASA).
// Carte d'identité du Soleil : libellé, puis valeur (début du tableau).
const FACTS = [
  // Le type spectral.
  ['Type spectral', 'G2V, naine jaune'],
  // Le rayon.
  ['Rayon', '696 340 km (109 Terres)'],
  // La masse.
  ['Masse', '1,989 × 10³⁰ kg (333 000 Terres)'],
  // La température de surface.
  ['Température de surface', '5 772 K'],
  // La température du cœur.
  ['Température du cœur', '≈ 15 millions K'],
  // La rotation.
  ['Rotation', '25,4 j à l’équateur, ≈ 34 j aux pôles'],
  // L'âge.
  ['Âge', '≈ 4,6 milliards d’années'],
  // Le cycle d'activité.
  ['Cycle d’activité', 'Cycle 25 (début en décembre 2019)'],
// Fin du tableau.
];

// nf : nombre au format français, avec un nombre fixe de décimales (0 par défaut).
const nf = (n, d = 0) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
// fmtDate : date complète en français (jour, mois, année, heure et minutes).
const fmtDate = (ms) => new Date(ms).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
// Déclare fmtDay, qui écrit une date courte à partir d'un texte.
const fmtDay = (iso) => {
  // Lit le texte comme une date en temps universel : l'espace devient « T », et « Z » est ajouté s'il n'y a pas de fuseau.
  const t = Date.parse(iso?.replace(' ', 'T') + (/[Zz+]/.test(iso || '') ? '' : 'Z'));
  // Date lisible : jour, mois abrégé, heure et minutes ; sinon le texte d'origine.
  return Number.isFinite(t) ? new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : iso;
// Fin de fmtDay.
};
// flareColor : couleur d'une éruption selon sa classe (rouge pour X, orange pour M, neutre sinon).
const flareColor = (cls) => (/^X/i.test(cls) ? 'error' : /^M/i.test(cls) ? 'warning' : 'default');
// Déclare fmtHelio, qui écrit une position héliographique à la manière des observatoires : « N16 E35 ».
const fmtHelio = (lat, lon) => {
  // L'hémisphère : nord pour une latitude positive ou nulle, sud sinon.
  const ns = `${lat >= 0 ? 'N' : 'S'}${Math.round(Math.abs(lat)).toString().padStart(2, '0')}`;
  // La direction : ouest pour une longitude positive ou nulle, est sinon.
  const ew = `${lon >= 0 ? 'W' : 'E'}${Math.round(Math.abs(lon)).toString().padStart(2, '0')}`;
  // Les deux, séparés par une espace.
  return `${ns} ${ew}`;
// Fin de fmtHelio.
};

// Déclare le composant Rows : reçoit des lignes [libellé, valeur].
function Rows({ rows }) {
  // Début du rendu.
  return (
    // Petit tableau.
    <Table size="small">
      {/* Corps du tableau. */}
      <TableBody>
        {/* Une ligne par couple (début). */}
        {rows.map(([k, v]) => (
          // La ligne.
          <TableRow key={k}>
            {/* Le libellé, en couleur secondaire, sur 46 % de la largeur. */}
            <TableCell sx={{ pl: 0, color: 'text.secondary', width: '46%' }}>{k}</TableCell>
            {/* La valeur, en chiffres de largeur fixe. */}
            <TableCell sx={{ pr: 0, fontVariantNumeric: 'tabular-nums' }}>{v}</TableCell>
          {/* Fin de la ligne. */}
          </TableRow>
        // Fin des lignes.
        ))}
      {/* Fin du corps du tableau. */}
      </TableBody>
    {/* Fin du tableau. */}
    </Table>
  // Fin du rendu.
  );
// Fin de Rows.
}

// Déclare le composant Title : un titre et un ornement facultatif.
function Title({ children, adornment }) {
  // Début du rendu.
  return (
    // Ligne du titre ; le premier titre n'a pas de marge en haut.
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2, mb: 0.5, '&:first-of-type': { mt: 0 } }}>
      {/* Le titre de niveau 3, au style overline, couleur primaire. */}
      <Typography component="h3" variant="overline" color="primary" sx={{ lineHeight: 1.6 }}>{children}</Typography>
      {/* L'ornement. */}
      {adornment}
    {/* Fin de la ligne. */}
    </Stack>
  // Fin du rendu.
  );
// Fin de Title.
}

/**
 * Contenu du panneau Informations quand le Soleil est ciblé (vue d'ensemble) :
 * grandeurs en direct, saisons, activité solaire (NOAA) et carte d'identité.
 */
// Déclare et exporte le composant SunInfo : reçoit les éléments orbitaux de la Terre.
export function SunInfo({ earthElements }) {
  // Indicateur « ouvert », toujours vrai ici.
  const open = true;
  // État : l'instant présent, en millisecondes.
  const [now, setNow] = useState(() => Date.now());
  // État de l'activité solaire : statut et données.
  const [activity, setActivity] = useState({ state: 'idle', data: null });
  // État des régions actives : les données, ou null tant qu'elles ne sont pas chargées.
  const [regions, setRegions] = useState(null);

  // Effet de l'horloge.
  useEffect(() => {
    // Fermé : rien à faire.
    if (!open) return undefined;
    // Met l'instant à jour toutes les secondes.
    const id = setInterval(() => setNow(Date.now()), 1000);
    // Nettoyage : arrête l'horloge.
    return () => clearInterval(id);
  // Fin de l'effet ; dépendance : open.
  }, [open]);

  // Effet qui charge l'activité solaire.
  useEffect(() => {
    // Fermé : rien à faire.
    if (!open) return undefined;
    // Crée un contrôleur d'annulation.
    const ctrl = new AbortController();
    // Passe au statut « chargement », en gardant les données précédentes.
    setActivity((a) => ({ ...a, state: 'loading' }));
    // Lance le chargement.
    fetchSolarActivity(ctrl.signal)
      // Réussite : statut « prêt », avec les données.
      .then((data) => setActivity({ state: 'ready', data }))
      // Échec, sauf annulation volontaire : statut « erreur ».
      .catch((e) => { if (e.name !== 'AbortError') setActivity({ state: 'error', data: null }); });
    // Nettoyage : annule la requête en cours.
    return () => ctrl.abort();
  // Fin de l'effet ; dépendance : open.
  }, [open]);

  // Effet qui charge les régions actives.
  useEffect(() => {
    // Fermé : rien à faire.
    if (!open) return undefined;
    // Crée un contrôleur d'annulation.
    const ctrl = new AbortController();
    // Lance le chargement.
    fetchSolarRegions(ctrl.signal)
      // Réussite : garde les données.
      .then((data) => setRegions(data))
      // Un échec est ignoré : la section n'est alors pas affichée.
      .catch(() => {});
    // Nettoyage : annule la requête en cours.
    return () => ctrl.abort();
  // Fin de l'effet ; dépendance : open.
  }, [open]);

  // Grandeurs en direct, si les éléments orbitaux sont connus.
  const live = earthElements ? sunLive(earthElements, now) : null;
  // Saisons et apsides : recalculées à l'ouverture seulement.
  // Saisons et apsides (début du calcul mémorisé).
  const calendar = useMemo(() => {
    // Fermé ou sans éléments orbitaux : rien.
    if (!open || !earthElements) return null;
    // L'instant du calcul.
    const t = Date.now();
    // Les prochaines saisons et les prochains apsides.
    return { seasons: nextSeasons(earthElements, t), apsides: nextApsides(earthElements, t) };
  // Fin du calcul ; dépendances : open et les éléments orbitaux.
  }, [open, earthElements]);

  // Raccourci vers les données d'activité.
  const a = activity.data;
  // Minutes du trajet de la lumière.
  const lightMin = live ? Math.floor(live.lightSeconds / 60) : 0;
  // Secondes restantes du trajet de la lumière.
  const lightSec = live ? Math.round(live.lightSeconds % 60) : 0;

  // Début du rendu.
  return (
    // Conteneur de la fiche.
    <Box>
        {/* S'il y a des grandeurs en direct (début). */}
        {live && (
          // Fragment du bloc.
          <>
            {/* Le titre du bloc. */}
            <Title>Depuis la Terre, maintenant</Title>
            {/* Ses lignes (début). */}
            <Rows rows={[
              // La distance, en kilomètres et en unités astronomiques.
              ['Distance', `${nf(live.km)} km (${nf(live.au, 5)} UA)`],
              // Le trajet de la lumière, en minutes et secondes.
              ['Trajet de la lumière', `${lightMin} min ${String(lightSec).padStart(2, '0')} s`],
              // Le diamètre apparent, en minutes d'arc.
              ['Diamètre apparent', `${nf(live.diameterArcmin, 2)}′`],
              // L'éclairement hors atmosphère.
              ['Éclairement (hors atmosphère)', `${nf(live.irradiance)} W/m²`],
              // La longitude écliptique.
              ['Longitude écliptique', `${nf(live.lon, 2)}°`],
            // Fin des lignes.
            ]} />
          {/* Fin du fragment. */}
          </>
        // Fin du cas.
        )}

        {/* S'il y a un calendrier (début). */}
        {calendar && (
          // Fragment du bloc.
          <>
            {/* Le titre du bloc. */}
            <Title>Prochaines saisons</Title>
            {/* Ses lignes (début). */}
            <Rows rows={[
              // Une ligne par saison, avec sa date.
              ...calendar.seasons.map((s) => [s.name, fmtDate(s.ms)]),
              // Le périhélie, s'il est connu : sa date et sa distance en kilomètres.
              ...(calendar.apsides.perihelion ? [['Périhélie (au plus près)', `${fmtDate(calendar.apsides.perihelion.ms)} · ${nf(calendar.apsides.perihelion.au * 149597870.7)} km`]] : []),
              // L'aphélie, s'il est connu : sa date et sa distance en kilomètres.
              ...(calendar.apsides.aphelion ? [['Aphélie (au plus loin)', `${fmtDate(calendar.apsides.aphelion.ms)} · ${nf(calendar.apsides.aphelion.au * 149597870.7)} km`]] : []),
            // Fin des lignes.
            ]} />
          {/* Fin du fragment. */}
          </>
        // Fin du cas.
        )}

        {/* Le titre « Activité solaire », avec l'étiquette NOAA quand les données sont prêtes. */}
        <Title adornment={activity.state === 'ready' ? <Chip size="small" label="NOAA" variant="outlined" /> : null}>Activité solaire</Title>
        {/* Pendant le chargement : un message d'attente. */}
        {activity.state === 'loading' && <Typography variant="body2" color="text.secondary">Chargement de la météo spatiale…</Typography>}
        {/* En cas d'erreur : un message d'indisponibilité. */}
        {activity.state === 'error' && <Typography variant="body2" color="text.secondary">Météo spatiale indisponible pour le moment.</Typography>}
        {/* S'il y a des données (début). */}
        {a && (
          // Fragment du bloc.
          <>
            {/* Ses lignes (début). */}
            <Rows rows={[
              // L'indice Kp et son libellé, un tiret s'il manque.
              ['Indice Kp', a.kp ? `${nf(a.kp.value, 1)} · ${kpLabel(a.kp.value)}` : '—'],
              // La vitesse du vent solaire, un tiret si elle manque.
              ['Vent solaire', a.solarWind ? `${nf(a.solarWind.speed)} km/s` : '—'],
              // Le nombre de taches solaires et son mois, un tiret s'il manque.
              ['Taches solaires', a.sunspots ? `${nf(a.sunspots.value)} (moyenne de ${a.sunspots.month})` : '—'],
            // Fin des lignes.
            ]} />
            {/* Sous-titre des éruptions. */}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, mb: 0.5 }}>Éruptions des 7 derniers jours (classe C et plus)</Typography>
            {/* S'il n'y a aucune éruption (début). */}
            {a.flares.length === 0 ? (
              // Un message qui le dit.
              <Typography variant="body2">Aucune éruption notable.</Typography>
            // Sinon (début).
            ) : (
              // Rangée d'étiquettes, qui passe à la ligne.
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                {/* Une étiquette par éruption (début). */}
                {a.flares.map((f) => (
                  // L'étiquette : classe et date, colorée selon la classe.
                  <Chip key={`${f.cls}-${f.peak || f.begin}`} size="small" color={flareColor(f.cls)} label={`${f.cls} · ${fmtDay(f.peak || f.begin)}`} />
                // Fin des étiquettes.
                ))}
              {/* Fin de la rangée. */}
              </Stack>
            // Fin du choix.
            )}
          {/* Fin du fragment. */}
          </>
        // Fin du cas.
        )}

        {/* S'il y a des régions actives (début). */}
        {regions?.regions?.length > 0 && (
          // Fragment du bloc.
          <>
            {/* Le titre « Régions actives », avec le nombre de régions. */}
            <Title adornment={<Chip size="small" label={`${regions.regions.length} régions`} variant="outlined" />}>Régions actives</Title>
            {/* La note du repère des positions. */}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              {/* Ce que veut dire la position, et ce qu'elle sert à placer. */}
              Position vue de la Terre (N/S = latitude, E/W = longitude depuis le méridien central) : ce sont ces régions qui éclatent sur le Soleil en 3D.
            {/* Fin de la note. */}
            </Typography>
            {/* Les lignes : une par région, les plus grandes d'abord (début). */}
            <Rows rows={regions.regions.slice(0, 8).map((r) => [
              // Le libellé : le numéro NOAA de la région.
              `AR ${r.number}`,
              // La valeur : sa position, sa surface, ses taches, et la probabilité d'éruption la plus parlante.
              [
                // sa position ;
                fmtHelio(r.lat, r.lon),
                // sa surface en millionièmes de disque, si elle est connue ;
                r.area ? `${nf(r.area)} µdisque` : null,
                // son nombre de taches, s'il est connu ;
                r.spots ? `${nf(r.spots)} taches` : null,
                // sa classe magnétique, si elle est connue ;
                r.magClass,
                // la probabilité d'éruption de classe X, puis M, puis C : la première non nulle.
                r.probability?.x ? `X ${r.probability.x} %` : r.probability?.m ? `M ${r.probability.m} %` : r.probability?.c ? `C ${r.probability.c} %` : null,
              // on écarte les éléments absents et on joint le reste.
              ].filter(Boolean).join(' · '),
            // Fin des lignes.
            ])} />
            {/* S'il y a des éruptions localisées (début). */}
            {regions.flares?.length > 0 && (
              // Fragment du bloc.
              <>
                {/* Sous-titre des éruptions localisées. */}
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, mb: 0.5 }}>Éruptions localisées des 3 derniers jours</Typography>
                {/* Rangée d'étiquettes, qui passe à la ligne. */}
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  {/* Une étiquette par éruption (début). */}
                  {regions.flares.map((f) => (
                    // L'étiquette : classe, position de départ et date, colorée selon la classe.
                    <Chip key={`${f.cls}-${f.peak || f.begin}`} size="small" color={flareColor(f.cls)} label={`${f.cls} · ${fmtHelio(f.lat, f.lon)} · ${fmtDay(f.peak || f.begin)}`} />
                  // Fin des étiquettes.
                  ))}
                {/* Fin de la rangée. */}
                </Stack>
              {/* Fin du fragment. */}
              </>
            // Fin du cas.
            )}
          {/* Fin du fragment. */}
          </>
        // Fin du cas.
        )}

        {/* Le titre « Carte d'identité ». */}
        <Title>Carte d’identité</Title>
        {/* Ses lignes. */}
        <Rows rows={FACTS} />

        {/* Bloc de la note finale. */}
        <Box sx={{ mt: 2 }}>
          {/* La note (début de la balise). */}
          <Typography variant="caption" color="text.secondary">
            {/* L'origine des calculs et de l'activité solaire (texte sur deux lignes). */}
            Grandeurs en direct et saisons calculées à partir des éléments orbitaux JPL (précision de quelques heures).
            Activité solaire : NOAA Space Weather Prediction Center, actualisée toutes les 10 min.
            Régions actives : NOAA SWPC (groupes de taches) et NASA DONKI (éruptions localisées), actualisées toutes les 15 min.
          {/* Fin de la note. */}
          </Typography>
        {/* Fin du bloc. */}
        </Box>
    {/* Fin du conteneur. */}
    </Box>
  // Fin du rendu.
  );
// Fin de SunInfo.
}
