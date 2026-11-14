// Importe de React les crochets useEffect, useMemo et useState.
import { useEffect, useMemo, useState } from 'react';
// Importe plusieurs composants de MUI (début de la liste).
import {
  // Alerte, Box, bouton, étiquette, roue et barre de chargement, boîte de dialogue et éléments de liste.
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogContent, LinearProgress, List, ListItemButton, ListItemText,
  // Entrée de menu, pile, onglets, champ de texte et Typography.
  MenuItem, Stack, Tab, Tabs, TextField, Typography,
// Fin de la liste ; module d'origine.
} from '@mui/material';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/composante/hooks/useViewport';
// Importe les langues d'un pays, les types de langue et la recherche de langues.
import { countryLanguages, LANGUAGE_TYPES, searchLanguages } from '@/moteur/i18n/i18nMath';
// Importe l'en-tête commun des fenêtres.
import { PanelHeader } from '../ui/PanelHeader';

// Les 20 écritures les plus utilisées, dans l'ordre (nombre d'utilisateurs) ; les codes ISO 15924 voisins sont regroupés.
// Écritures principales : code, nom affiché et codes regroupés (début du tableau).
const MAIN_SCRIPTS = [
  // Latin (code Latn).
  ['Latn', 'Latin', ['Latn']],
  // Chinois (sinogrammes) (code Hani), qui regroupe Hani, Hans, Hant.
  ['Hani', 'Chinois (sinogrammes)', ['Hani', 'Hans', 'Hant']],
  // Arabe (code Arab).
  ['Arab', 'Arabe', ['Arab']],
  // Devanagari (code Deva).
  ['Deva', 'Devanagari', ['Deva']],
  // Bengali-assamais (code Beng).
  ['Beng', 'Bengali-assamais', ['Beng']],
  // Cyrillique (code Cyrl).
  ['Cyrl', 'Cyrillique', ['Cyrl']],
  // Japonais (kana + kanji) (code Jpan), qui regroupe Jpan, Hira, Kana.
  ['Jpan', 'Japonais (kana + kanji)', ['Jpan', 'Hira', 'Kana']],
  // Télougou (code Telu).
  ['Telu', 'Télougou', ['Telu']],
  // Hangeul (code Hang), qui regroupe Hang, Kore.
  ['Hang', 'Hangeul', ['Hang', 'Kore']],
  // Tamoul (code Taml).
  ['Taml', 'Tamoul', ['Taml']],
  // Gujarati (code Gujr).
  ['Gujr', 'Gujarati', ['Gujr']],
  // Kannada (code Knda).
  ['Knda', 'Kannada', ['Knda']],
  // Birman (code Mymr).
  ['Mymr', 'Birman', ['Mymr']],
  // Thaï (code Thai).
  ['Thai', 'Thaï', ['Thai']],
  // Malayalam (code Mlym).
  ['Mlym', 'Malayalam', ['Mlym']],
  // Guèze (éthiopien) (code Ethi).
  ['Ethi', 'Guèze (éthiopien)', ['Ethi']],
  // Grec (code Grek).
  ['Grek', 'Grec', ['Grek']],
  // Hébreu (code Hebr).
  ['Hebr', 'Hébreu', ['Hebr']],
  // Arménien (code Armn).
  ['Armn', 'Arménien', ['Armn']],
  // Géorgien (code Geor).
  ['Geor', 'Géorgien', ['Geor']],
// Fin du tableau.
];
// Ensemble de tous les codes des écritures principales.
const MAIN_CODES = new Set(MAIN_SCRIPTS.flatMap((s) => s[2]));
// Nombre maximal de langues affichées dans la liste.
const LIST_LIMIT = 200;

// Déclare scriptLabel : nom d'une écriture à partir de son code.
const scriptLabel = (scripts, code) => {
  // Cherche l'écriture dans le référentiel.
  const s = scripts?.[code];
  // Inconnue : le code lui-même.
  if (!s) return code;
  // Son nom, suivi de son second libellé s'il existe.
  return s[1] ? `${s[0]} · ${s[1]}` : s[0];
// Fin de scriptLabel.
};

// Déclare le composant LanguageRow : la langue, la sélection, les écritures, les données propres au pays et le rappel de choix.
function LanguageRow({ entry, selected, scripts, extra, onPick }) {
  // Type de la langue en clair, sauf pour une langue vivante (type « l »).
  const type = entry.type !== 'l' ? LANGUAGE_TYPES[entry.type] : '';
  // Début du rendu.
  return (
    // La ligne cliquable, sélectionnée s'il y a lieu.
    <ListItemButton selected={selected} onClick={onPick} dense sx={{ borderRadius: 1 }}>
      {/* Ses textes (début de la balise). */}
      <ListItemText
        // Jamais traduits.
        translate="no"
        // Ligne principale (début).
        primary={(
          // Rangée alignée sur la ligne de base.
          <Stack direction="row" spacing={1} alignItems="baseline" sx={{ minWidth: 0 }}>
            {/* Le nom de la langue dans sa propre langue (son nom courant à défaut), en demi-gras. */}
            <Box component="span" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.autonym || entry.name}</Box>
            {/* Si ce nom diffère du nom courant (début). */}
            {entry.autonym && entry.autonym !== entry.name && (
              // Le nom courant, en plus petit.
              <Box component="span" sx={{ color: 'text.secondary', fontSize: 13 }}>{entry.name}</Box>
            // Fin du cas.
            )}
          {/* Fin de la rangée. */}
          </Stack>
        // Fin de la ligne principale.
        )}
        // Ligne secondaire (début du tableau).
        secondary={[
          // Le code ISO de la langue.
          entry.code3,
          // L'écriture du pays, sinon toutes les écritures de la langue.
          (extra?.script ? [extra.script] : entry.scripts).map((c) => scriptLabel(scripts, c)).join(', '),
          // Le type de la langue.
          type,
          // La part de la population, si elle est connue.
          extra?.percent ? `${extra.percent} % de la population` : '',
          // La mention « officielle », s'il y a lieu.
          extra?.official ? 'officielle' : '',
        // Sans les entrées vides, jointes par un point médian.
        ].filter(Boolean).join(' · ')}
        // Ligne secondaire en petit.
        slotProps={{ secondary: { fontSize: 12 } }}
      // Fin des textes.
      />
    {/* Fin de la ligne cliquable. */}
    </ListItemButton>
  // Fin du rendu.
  );
// Fin de LanguageRow.
}

/**
 * Langue de l'interface : par pays (langues parlées, part de la population, écritures), ou parmi les ~7 900 langues
 * ISO 639-3 avec recherche et filtre par écriture. Par défaut : la langue du navigateur.
 */
// Déclare et exporte le composant Langue : ouverture, fermeture et état de la langue de l'interface.
export function Langue({ open, onClose, language }) {
  // Lit le mode compact.
  const { compact } = useViewport();
  // Extrait le référentiel, son erreur, son chargement, la sélection, l'état de la traduction, le réglage et le nom d'une langue.
  const { data, dataError, ensureData, effective, status, setLanguage, nameOf } = language;
  // État : l'onglet affiché, « Par pays » au départ.
  const [tab, setTab] = useState('country');
  // État : le pays choisi.
  const [country, setCountry] = useState('');
  // État : le texte recherché.
  const [query, setQuery] = useState('');
  // État : l'écriture choisie comme filtre.
  const [script, setScript] = useState('');

  // À l'ouverture : charge le référentiel.
  useEffect(() => { if (open) ensureData(); }, [open, ensureData]);
  // Effet qui choisit le pays de départ.
  useEffect(() => {
    // À l'ouverture, sans pays choisi : celui de la sélection, la France à défaut.
    if (open && effective && !country) setCountry(effective.country || 'FR');
  // Fin de l'effet ; dépendances : l'ouverture, la sélection et le pays.
  }, [open, effective, country]);

  // Fiche du pays choisi, null si elle manque.
  const countryRow = data?.countryByCode.get(country) || null;
  // Langues du pays, liste vide sans référentiel.
  const countryLangs = useMemo(() => (data ? countryLanguages(countryRow, data.byCode3) : []), [data, countryRow]);
  // Écritures du pays, sans doublon ni valeur vide.
  const countryScripts = useMemo(() => [...new Set(countryLangs.map((l) => l.script).filter(Boolean))], [countryLangs]);

  // Autres écritures (début du calcul mémorisé).
  const otherScripts = useMemo(() => (data
    // Celles du référentiel qui ne sont pas principales, triées par nom.
    ? Object.keys(data.scripts).filter((c) => !MAIN_CODES.has(c)).sort((a, b) => data.scripts[a][0].localeCompare(data.scripts[b][0], 'fr'))
    // Liste vide sans référentiel ; dépendance : le référentiel.
    : []), [data]);

  // Résultats de l'onglet « Toutes les langues » (début du calcul mémorisé).
  const results = useMemo(() => {
    // Sans référentiel ou sur l'autre onglet : rien.
    if (!data || tab !== 'all') return { total: 0, items: [] };
    // Le groupe d'écritures principal choisi, s'il y en a un.
    const group = MAIN_SCRIPTS.find((s) => s[0] === script);
    // Les codes à chercher : ceux du groupe, le code choisi, ou aucun.
    const codes = group ? group[2] : script ? [script] : [];
    // Un code au plus : une seule recherche.
    if (codes.length <= 1) return searchLanguages(data.entries, query, { script: codes[0] || '', limit: LIST_LIMIT });
    // Plusieurs codes : résultats fusionnés par code de langue.
    const merged = new Map();
    // Total cumulé.
    let total = 0;
    // Pour chaque code.
    for (const c of codes) {
      // Cherche les langues de cette écriture.
      const r = searchLanguages(data.entries, query, { script: c, limit: LIST_LIMIT });
      // Ajoute son total.
      total += r.total;
      // Ajoute ses langues, sans doublon.
      r.items.forEach((e) => merged.set(e.code3, e));
    // Fin du parcours.
    }
    // Le total (au moins le nombre de langues fusionnées) et les langues, limitées au maximum.
    return { total: Math.max(total, merged.size), items: [...merged.values()].slice(0, LIST_LIMIT) };
  // Fin du calcul ; dépendances : le référentiel, l'onglet, le texte et l'écriture.
  }, [data, tab, query, script]);

  // pick : choisit une langue, avec le pays (celui de la sélection à défaut) et l'écriture.
  const pick = (entry, extra = {}) => setLanguage({ code3: entry.code3, country: extra.country ?? effective?.country ?? '', script: extra.script || '' });
  // La langue en cours.
  const current = effective?.entry;
  // La langue demandée au traducteur.
  const requested = status?.requested;
  // La langue réellement affichée.
  const active = status?.active;
  // Vrai si une langue de repli est affichée, hors français.
  const fallback = status?.fallback && current && current.code3 !== 'fra';

  // Début du rendu.
  return (
    // Boîte de dialogue : plein écran en mode compact, petite largeur sinon.
    <Dialog open={open} onClose={onClose} fullScreen={compact} maxWidth="sm" fullWidth aria-label="Langue de l’interface">
      {/* L'en-tête, avec le titre et la fermeture. */}
      <PanelHeader title="Langue de l’interface" onClose={onClose} />
      {/* Contenu en colonne ; hauteur minimale de 520 px hors mode compact. */}
      <DialogContent sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: compact ? 0 : 520 }}>
        {/* S'il y a une langue en cours (début). */}
        {current && (
          // Ligne de la langue choisie (début de la balise).
          <Typography variant="body2">
            {/* Le libellé et le nom de la langue, jamais traduit. */}
            Langue choisie : <Box component="strong" translate="no">{current.autonym || current.name}</Box>
            {/* La mention « langue du navigateur », en mode automatique. */}
            {effective.auto && ' (langue du navigateur)'}
          {/* Fin de la ligne. */}
          </Typography>
        // Fin du cas.
        )}

        {/* Si une langue de repli est affichée (début). */}
        {fallback && (
          // Message d'information (début de la balise).
          <Alert severity="info" variant="outlined">
            {/* Début de l'explication, suivi d'une espace. */}
            Pas de traduction automatique pour cette langue chez MyMemory : l’interface est affichée en{' '}
            {/* Le nom de la langue affichée, puis la fin de la phrase. */}
            <Box component="strong" translate="no">{nameOf(active)}</Box>, la langue la plus proche disponible.
          {/* Fin du message. */}
          </Alert>
        // Fin du cas.
        )}
        {/* Si le quota de traduction est atteint (début). */}
        {status?.quota && (
          // Message d'avertissement (début de la balise).
          <Alert severity="warning" variant="outlined">
            {/* Son texte. */}
            Quota gratuit de traduction MyMemory atteint pour aujourd’hui : les textes pas encore traduits restent en français.
          {/* Fin du message. */}
          </Alert>
        // Fin du cas.
        )}
        {/* Si une traduction est en cours, hors quota (début). */}
        {active && status?.pending > 0 && !status.quota && (
          // Bloc de progression.
          <Box>
            {/* Le libellé. */}
            <Typography variant="caption" color="text.secondary">Traduction en cours…</Typography>
            {/* La barre de progression. */}
            <LinearProgress sx={{ mt: 0.5 }} />
          {/* Fin du bloc. */}
          </Box>
        // Fin du cas.
        )}
        {/* Si une langue est demandée mais qu'aucune traduction n'est disponible (début). */}
        {requested && !active && !status?.fallback && !status?.quota && current?.code3 !== 'fra' && (
          // Une note qui le dit.
          <Typography variant="caption" color="text.secondary">Aucune traduction automatique disponible : interface en français.</Typography>
        // Fin du cas.
        )}

        {/* Rangée des deux raccourcis. */}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {/* « Langue du navigateur » : pleine si elle est active ; un clic efface le choix. */}
          <Chip label="Langue du navigateur" color={effective?.auto ? 'primary' : 'default'} variant={effective?.auto ? 'filled' : 'outlined'} onClick={() => setLanguage(null)} />
          {/* « Français (original) » : pleine si le français est choisi ; un clic le choisit. */}
          <Chip label="Français (original)" translate="no" color={!effective?.auto && current?.code3 === 'fra' ? 'primary' : 'default'} variant={!effective?.auto && current?.code3 === 'fra' ? 'filled' : 'outlined'} onClick={() => setLanguage({ code3: 'fra', country: 'FR', script: 'Latn' })} />
        {/* Fin de la rangée. */}
        </Stack>

        {/* Les deux onglets, sur toute la largeur. */}
        <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="fullWidth" sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36 } }}>
          {/* Onglet « Par pays ». */}
          <Tab value="country" label="Par pays" />
          {/* Onglet « Toutes les langues », avec leur nombre quand il est connu. */}
          <Tab value="all" label={data ? `Toutes les langues (${data.entries.length.toLocaleString('fr-FR')})` : 'Toutes les langues'} />
        {/* Fin des onglets. */}
        </Tabs>

        {/* Pendant le chargement du référentiel : une roue. */}
        {!data && !dataError && <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress size={28} /></Box>}
        {/* En cas d'erreur : un message. */}
        {dataError && <Alert severity="error" variant="outlined">Liste des langues indisponible. Réessayez plus tard.</Alert>}

        {/* Onglet « Par pays », avec le référentiel (début). */}
        {data && tab === 'country' && (
          // Fragment de l'onglet.
          <>
            {/* La liste déroulante des pays. */}
            <TextField select size="small" label="Pays" value={countryRow ? country : ''} onChange={(e) => setCountry(e.target.value)}>
              {/* Une entrée par pays (début). */}
              {data.countries.map(([cc, name]) => (
                // L'entrée : le nom du pays.
                <MenuItem key={cc} value={cc} dense>{name}</MenuItem>
              // Fin des entrées.
              ))}
            {/* Fin de la liste déroulante. */}
            </TextField>
            {/* Si le pays a des écritures (début). */}
            {countryScripts.length > 0 && (
              // Bloc des écritures.
              <Box>
                {/* Le libellé. */}
                <Typography variant="caption" color="text.secondary">Écritures du pays</Typography>
                {/* Rangée d'étiquettes. */}
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                  {/* Une étiquette par écriture. */}
                  {countryScripts.map((c) => <Chip key={c} size="small" variant="outlined" label={scriptLabel(data.scripts, c)} />)}
                {/* Fin de la rangée. */}
                </Stack>
              {/* Fin du bloc. */}
              </Box>
            // Fin du cas.
            )}
            {/* La liste des langues du pays, qui défile. */}
            <List dense sx={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {/* Une ligne par langue (début). */}
              {countryLangs.map((l) => (
                // La ligne (début de la balise).
                <LanguageRow
                  // Clé unique : le code et l'écriture.
                  key={`${l.code3}-${l.script}`}
                  // La langue.
                  entry={l}
                  // Les écritures du référentiel.
                  scripts={data.scripts}
                  // Les données propres au pays.
                  extra={l}
                  // Sélectionnée si c'est la langue en cours, dans ce pays.
                  selected={current?.code3 === l.code3 && effective?.country === country}
                  // Au clic : la choisit, avec ce pays et son écriture.
                  onPick={() => pick(l, { country, script: l.script })}
                // Fin de la ligne.
                />
              // Fin des lignes.
              ))}
            {/* Fin de la liste. */}
            </List>
          {/* Fin du fragment. */}
          </>
        // Fin de l'onglet.
        )}

        {/* Onglet « Toutes les langues », avec le référentiel (début). */}
        {data && tab === 'all' && (
          // Fragment de l'onglet.
          <>
            {/* Rangée des deux champs, en colonne en mode compact. */}
            <Stack direction={compact ? 'column' : 'row'} spacing={1}>
              {/* Le champ de recherche, qui reçoit le focus hors mode compact. */}
              <TextField size="small" label="Rechercher une langue (nom ou code)" value={query} onChange={(e) => setQuery(e.target.value)} sx={{ flex: 2 }} autoFocus={!compact} />
              {/* La liste déroulante des écritures. */}
              <TextField select size="small" label="Écriture" value={script} onChange={(e) => setScript(e.target.value)} sx={{ flex: 1, minWidth: 180 }}>
                {/* Entrée « Toutes les écritures ». */}
                <MenuItem value="">Toutes les écritures</MenuItem>
                {/* Une entrée par écriture principale. */}
                {MAIN_SCRIPTS.map(([code, label]) => <MenuItem key={code} value={code} dense>{label}</MenuItem>)}
                {/* Une entrée par autre écriture. */}
                {otherScripts.map((code) => <MenuItem key={code} value={code} dense>{scriptLabel(data.scripts, code)}</MenuItem>)}
              {/* Fin de la liste déroulante. */}
              </TextField>
            {/* Fin de la rangée. */}
            </Stack>
            {/* Ligne du décompte (début de la balise). */}
            <Typography variant="caption" color="text.secondary">
              {/* Le nombre de langues trouvées. */}
              {results.total.toLocaleString('fr-FR')} langue(s)
              {/* Si tout n'est pas affiché : le nombre de langues affichées et une invitation à préciser. */}
              {results.total > results.items.length && `, ${results.items.length} premières affichées : précisez la recherche`}
            {/* Fin de la ligne. */}
            </Typography>
            {/* La liste des langues, qui défile. */}
            <List dense sx={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {/* Une ligne par langue (début). */}
              {results.items.map((e) => (
                // La ligne : sélectionnée si c'est la langue en cours ; un clic la choisit, avec l'écriture filtrée si la langue l'utilise.
                <LanguageRow key={e.code3} entry={e} scripts={data.scripts} selected={current?.code3 === e.code3} onPick={() => pick(e, { script: script && e.scripts.includes(script) ? script : '' })} />
              // Fin des lignes.
              ))}
            {/* Fin de la liste. */}
            </List>
          {/* Fin du fragment. */}
          </>
        // Fin de l'onglet.
        )}

        {/* Note de bas de fenêtre, poussée en bas. */}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto' }}>
          {/* Les sources des langues et de la traduction. */}
          Langues : ISO 639-3 (SIL) et Unicode CLDR. Traduction automatique : MyMemory, pour les langues qu’il prend en charge.
        {/* Fin de la note. */}
        </Typography>
        {/* Le bouton « Fermer », aligné à droite. */}
        <Button onClick={onClose} sx={{ alignSelf: 'flex-end' }}>Fermer</Button>
      {/* Fin du contenu. */}
      </DialogContent>
    {/* Fin de la boîte de dialogue. */}
    </Dialog>
  // Fin du rendu.
  );
// Fin de Langue.
}
