// Importe de React les crochets useEffect, useMemo, useRef et useState.
import { useEffect, useMemo, useRef, useState } from 'react';
// Importe de MUI Box, Button, Dialog, IconButton, InputBase (champ nu), les éléments de liste et Stack.
import { Box, Button, Dialog, IconButton, InputBase, List, ListItem, ListItemButton, ListItemText, Stack } from '@mui/material';
// Importe searchPlaces, la recherche distante de lieux.
import { searchPlaces } from '@/moteur/api';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/composante/hooks/useViewport';
// Importe coords, qui met en forme des coordonnées.
import { coords } from '@/moteur/lib/format';
// Importe la largeur de vue d'une adresse, la normalisation de texte, le type d'un résultat et sa vignette.
import { ADDRESS_VIEW_M, fold, placeResultType, resultIcon } from '@/moteur/lib/search';
// Importe l'altitude pour une largeur de vue, la mise en forme et la lecture de coordonnées.
import { altitudeForView, formatLatLon, parseLatLon } from '@/moteur/engine/gps';
// Importe l'icône de fermeture.
import { CloseIcon, HomeIcon, LocationCityIcon, MyLocationIcon, PlaceIcon, PublicIcon } from '../ui/icons';

/** Icône d'un résultat de recherche : la clé rendue par `resultIcon` devient une icône MUI. */
const RESULT_ICONS = { astre: PublicIcon, ville: LocationCityIcon, lieu: PlaceIcon, adresse: HomeIcon, coordonnees: MyLocationIcon };
/** L'icône d'un type de résultat, dessinée à la taille de la ligne. */
const resultIconNode = (type) => {
  // Le composant d'icône de ce type, celui d'un lieu à défaut.
  const Icon = RESULT_ICONS[resultIcon(type)] ?? PlaceIcon;
  // Rendue à 20 px.
  return <Icon sx={{ fontSize: 20 }} />;
// Fin de resultIconNode.
};

// Nombre maximal de résultats par catégorie.
const MAX_RESULTS = 40;
// Format compact des populations, en français, avec une décimale au plus.
const popFmt = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
// Pause de frappe avant la recherche mondiale, en millisecondes.
const WORLD_DEBOUNCE_MS = 300;
// Largeur de vue pour un point GPS, en mètres.
const GPS_VIEW_M = 10; // un point GPS est survolé à l'échelle de 10 m (hauteur de l'écran)

/**
 * Recherche rapide (Ctrl K ou /) : astres, villes de l’API, ≈ 7 300 villes du globe (Natural Earth : nom, nom français,
 * nom local, pays), puis toutes les localités et les adresses du monde (OpenStreetMap via Photon). Chaque résultat
 * porte la vignette de son type (astre, ville, lieu, adresse, point GPS).
 * ↑ ↓ pour choisir, Entrée pour aller, Échap pour fermer. Plein écran sur téléphone.
 */
// Déclare et exporte le composant Rechercher : ouverture, fermeture, villes, villes du monde, noms des astres, trois rappels de choix et recherche mondiale.
export function Rechercher({ open, onClose, cities, worldCities = [], bodyNames, onPickCity, onPickBody, onPickPlace, worldSearch = false }) {
  // Lit le mode compact.
  const { compact } = useViewport();
  // État : le texte saisi.
  const [query, setQuery] = useState('');
  // État : le rang du résultat actif.
  const [active, setActive] = useState(0);
  // État de la recherche mondiale : requête, résultats et statut.
  const [world, setWorld] = useState({ q: '', items: [], status: 'idle' });
  // Référence vers le champ de saisie.
  const inputRef = useRef(null);
  // Référence vers la liste des résultats.
  const listRef = useRef(null);

  // Index local (début du calcul mémorisé).
  const index = useMemo(() => [
    // Les astres : nom, clé normalisée, rang et sous-titre « Astre ».
    ...bodyNames.map((name, i) => ({ type: 'body', name, key: fold(name), i, sub: 'Astre' })),
    // Les villes de l'API : nom, clé normalisée, rang et coordonnées en sous-titre.
    ...cities.map((c, i) => ({ type: 'city', name: c.name, key: fold(c.name), i, sub: coords(c.lat, c.lon) })),
  // Fin du calcul ; dépendances : les villes et les noms des astres.
  ], [cities, bodyNames]);

  // Villes du globe : recherchées par nom, nom français, nom local et pays ; déjà triées par population.
  // Index des villes du globe (début du calcul mémorisé).
  const worldIndex = useMemo(() => worldCities.map((c, i) => {
    // Nom français, sinon nom d'origine.
    const name = c.nameFr || c.name;
    // Pays en français, sinon d'origine, sinon vide.
    const country = c.countryFr || c.country || '';
    // L'entrée de l'index (début de l'objet).
    return {
      // Type, rang, nom et pays.
      type: 'world', i, name, country,
      // Clés de recherche : nom d'origine, nom français et nom local, normalisés.
      keys: [c.name, c.nameFr, c.native].filter(Boolean).map(fold),
      // Clé du pays, en français et d'origine.
      countryKey: fold(country + ' ' + (c.country || '')),
      // Sous-titre : le pays et la population.
      sub: [country, c.pop > 0 ? `${popFmt.format(c.pop)} hab.` : null].filter(Boolean).join(' · '),
      // Le lieu où aller.
      place: { name, lat: c.lat, lon: c.lon },
    // Fin de l'objet.
    };
  // Fin du calcul ; dépendance : les villes du monde.
  }), [worldCities]);

  // Effet de la recherche mondiale.
  useEffect(() => {
    // Le texte saisi, sans espaces autour.
    const q = query.trim();
    // Fenêtre fermée, recherche mondiale absente ou moins de 2 caractères : état au repos, et rien de plus.
    if (!open || !worldSearch || q.length < 2) { setWorld({ q: '', items: [], status: 'idle' }); return undefined; }
    // Crée un contrôleur d'annulation.
    const ctrl = new AbortController();
    // Passe au statut « chargement », en gardant les résultats précédents.
    setWorld((w) => ({ ...w, status: 'loading' }));
    // Programme la recherche après la pause de frappe.
    const t = setTimeout(() => {
      // Lance la recherche distante.
      searchPlaces(q, ctrl.signal)
        // Réussite : garde la requête, les résultats et le statut « prêt ».
        .then((r) => setWorld({ q, items: r.items, status: 'ready' }))
        // Échec, sauf annulation volontaire : aucun résultat et statut « erreur ».
        .catch((e) => { if (e.name !== 'AbortError') setWorld({ q, items: [], status: 'error' }); });
    // Fin de la programmation.
    }, WORLD_DEBOUNCE_MS);
    // Nettoyage : annule la pause et la requête.
    return () => { clearTimeout(t); ctrl.abort(); };
  // Fin de l'effet ; dépendances : l'ouverture, la recherche mondiale et le texte.
  }, [open, worldSearch, query]);

  // Liste des résultats (début du calcul mémorisé).
  const results = useMemo(() => {
    // La requête normalisée.
    const q = fold(query.trim());
    // Avec une requête : les entrées dont la clé la contient ; sans requête : les astres seuls.
    const hits = q ? index.filter((r) => r.key.includes(q)) : index.filter((r) => r.type === 'body');
    // Trie les entrées qui commencent par la requête avant les autres.
    if (q) hits.sort((a, b) => Number(!a.key.startsWith(q)) - Number(!b.key.startsWith(q)));
    // Résultats locaux, limités au maximum.
    const local = hits.slice(0, MAX_RESULTS);
    // Noms des villes déjà listées, pour éviter les doublons.
    const seen = new Set(local.filter((r) => r.type === 'city').map((r) => r.key));
    // Villes du globe : début de nom d'abord, puis nom contenu, puis pays (« japon » liste les villes japonaises).
    // Villes du globe retenues.
    const globe = [];
    // À partir de 2 caractères.
    if (q.length >= 2) {
      // Trois listes : début de nom, nom contenu, pays.
      const starts = [], contains = [], byCountry = [];
      // Parcourt les villes du globe.
      for (const r of worldIndex) {
        // Un nom commence par la requête : première liste.
        if (r.keys.some((k) => k.startsWith(q))) starts.push(r);
        // Un nom contient la requête : deuxième liste.
        else if (r.keys.some((k) => k.includes(q))) contains.push(r);
        // À partir de 3 caractères, le pays contient la requête : troisième liste.
        else if (q.length >= 3 && r.countryKey.includes(q)) byCountry.push(r);
        // S'arrête quand la première liste est pleine.
        if (starts.length >= MAX_RESULTS) break;
      // Fin du parcours.
      }
      // Parcourt les trois listes, dans cet ordre.
      for (const r of [...starts, ...contains, ...byCountry]) {
        // Le nom normalisé de la ville.
        const k = fold(r.name);
        // Déjà listée : ignorée.
        if (seen.has(k)) continue;
        // Note qu'elle est listée.
        seen.add(k);
        // L'ajoute.
        globe.push(r);
        // S'arrête au maximum.
        if (globe.length >= MAX_RESULTS) break;
      // Fin du parcours.
      }
    // Fin du cas.
    }
    // Localités OpenStreetMap : écartées seulement si la même ville (même nom, à moins de ~30 km) est déjà listée.
    // near : vrai si une ville du globe retenue a le même nom…
    const near = (p) => globe.some((r) => fold(r.name) === fold(p.name)
      // … et se trouve à moins de 0,3° en latitude et en longitude.
      && Math.abs(r.place.lat - p.lat) < 0.3 && Math.abs(r.place.lon - p.lon) < 0.3);
    // Résultats de la recherche mondiale (début)…
    const places = world.items
      // … sans ceux qui doublonnent une ville du globe…
      .filter((p) => !near(p))
      // … convertis en résultats (début).
      .map((p, i) => {
        // Adresse (rue, numéro) : survolée de près ; localité : altitude habituelle d'une ville.
        // Le type du résultat : lieu ou adresse.
        const type = placeResultType(p);
        // Pour une adresse : ajoute l'altitude qui donne une vue rapprochée.
        const place = type === 'address' ? { ...p, altitudeM: altitudeForView(ADDRESS_VIEW_M) } : p;
        // Le résultat : type, nom, rang, lieu et sous-titre (contexte, coordonnées à défaut).
        return { type, name: p.name, i, place, sub: p.context || coords(p.lat, p.lon) };
      // Fin de la conversion.
      });
    // Coordonnées saisies (« 48.8584, 2.2945 », « 48°51'30"N 2°17'40"E »…) : premier résultat, survol à 10 m.
    // Tente de lire des coordonnées dans le texte saisi.
    const point = parseLatLon(query);
    // Si c'en sont : un résultat GPS (début).
    const gps = point ? [{
      // Son type, son rang et son nom (les coordonnées à 6 décimales).
      type: 'gps', i: 0, name: formatLatLon(point.lat, point.lon, 6),
      // Son sous-titre.
      sub: `Coordonnées GPS · survol à l’échelle de ${GPS_VIEW_M} m`,
      // Le lieu où aller, à l'altitude qui donne une vue de 10 m.
      place: { name: formatLatLon(point.lat, point.lon, 5), lat: point.lat, lon: point.lon, altitudeM: altitudeForView(GPS_VIEW_M) },
    // Fin du résultat ; liste vide sinon.
    }] : [];
    // L'ordre final : GPS, résultats locaux, villes du globe, puis recherche mondiale.
    return [...gps, ...local, ...globe, ...places];
  // Fin du calcul ; dépendances : les deux index, le texte et les résultats mondiaux.
  }, [index, worldIndex, query, world.items]);

  // Effet relancé à l'ouverture.
  useEffect(() => {
    // Fenêtre fermée : rien à faire.
    if (!open) return undefined;
    // Vide le champ.
    setQuery('');
    // Revient au premier résultat.
    setActive(0);
    // Le dialogue MUI bloque déjà le défilement de la page ; le focus va au champ une fois la fenêtre montée.
    // Donne le focus au champ, juste après le montage de la fenêtre.
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    // Nettoyage : annule ce délai.
    return () => clearTimeout(t);
  // Fin de l'effet ; dépendance : l'ouverture.
  }, [open]);
  // À chaque frappe, le premier résultat redevient actif.
  useEffect(() => { setActive(0); }, [query]);
  // Fait défiler la liste pour garder le résultat actif visible.
  useEffect(() => { listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' }); }, [active]);

  // Déclare choose : choix d'un résultat.
  const choose = (r) => {
    // Sans résultat, rien à faire.
    if (!r) return;
    // Ville de l'API : va à la ville.
    if (r.type === 'city') onPickCity(r.i);
    // Lieu, adresse, point GPS ou ville du globe : va au lieu.
    else if (r.type === 'place' || r.type === 'address' || r.type === 'gps' || r.type === 'world') onPickPlace?.(r.place);
    // Sinon : va à l'astre.
    else onPickBody(r.i);
    // Retire le focus du champ.
    inputRef.current?.blur(); // referme le clavier virtuel
    // Ferme la fenêtre.
    onClose();
  // Fin de choose.
  };
  // Déclare onKeyDown : gestion du clavier.
  const onKeyDown = (e) => {
    // Flèche bas : résultat suivant, sans dépasser le dernier.
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    // Flèche haut : résultat précédent, sans dépasser le premier.
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    // Entrée : choisit le résultat actif.
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[active]); }
    // Échap : ferme la fenêtre.
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  // Fin de onKeyDown.
  };

  // empty : fabrique une ligne d'information non cliquable (début).
  const empty = (text) => (
    // La ligne, avec son texte en sous-titre.
    <ListItem aria-disabled="true"><ListItemText secondary={text} /></ListItem>
  // Fin de empty.
  );
  // Aucun résultat : petite planète dessinée au-dessus du message, plutôt qu'une ligne de texte seule.
  // nothing : fabrique le message « aucun résultat », avec son dessin (début).
  const nothing = (text) => (
    // La ligne, non cliquable, en colonne centrée.
    <ListItem aria-disabled="true" sx={{ flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 4, textAlign: 'center' }}>
      {/* Le dessin (svg), en couleur secondaire, décoratif. */}
      <Box component="svg" viewBox="0 0 96 64" aria-hidden="true" sx={{ width: 96, height: 64, color: 'text.secondary', opacity: 0.8 }}>
        {/* L'anneau de la planète, en entier, atténué. */}
        <ellipse cx="48" cy="34" rx="40" ry="9" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" />
        {/* Le disque de la planète, en aplat léger. */}
        <circle cx="48" cy="32" r="17" fill="currentColor" opacity="0.28" />
        {/* Le contour de la planète. */}
        <circle cx="48" cy="32" r="17" fill="none" stroke="currentColor" strokeWidth="2" />
        {/* La moitié avant de l'anneau, par-dessus la planète. */}
        <path d="M9.5 36.5 A40 9 0 0 0 86.5 36.5" fill="none" stroke="currentColor" strokeWidth="2" />
        {/* Une étoile. */}
        <circle cx="80" cy="12" r="1.6" fill="currentColor" />
        {/* Une étoile. */}
        <circle cx="16" cy="14" r="1.2" fill="currentColor" />
        {/* Une étoile. */}
        <circle cx="70" cy="56" r="1.2" fill="currentColor" />
      {/* Fin du dessin. */}
      </Box>
      {/* Le message. */}
      <ListItemText secondary={text} sx={{ m: 0 }} />
    {/* Fin de la ligne. */}
    </ListItem>
  // Fin de nothing.
  );

  // Début du rendu.
  return (
    // Boîte de dialogue (début de la balise).
    <Dialog
      // Ouverte ou non.
      open={open}
      // Fermeture.
      onClose={onClose}
      // Plein écran en mode compact.
      fullScreen={compact}
      // Toute la largeur disponible.
      fullWidth
      // Petite largeur maximale.
      maxWidth="sm"
      // Nom pour les lecteurs d'écran.
      aria-label="Rechercher"
      // Alignée en haut de l'écran, sauf en mode compact.
      sx={{ '& .MuiDialog-container': { alignItems: compact ? 'stretch' : 'flex-start' } }}
      // Décalée de 14 % de la hauteur de l'écran, sauf en mode compact.
      slotProps={{ paper: { sx: compact ? {} : { mt: '14vh' } } }}
    // Fin de la balise ouvrante.
    >
      {/* Ligne du champ et du bouton de fermeture, soulignée d'un filet. */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        {/* Le champ de saisie (début de la balise). */}
        <InputBase
          // Référence pour le focus.
          inputRef={inputRef}
          // Type « recherche ».
          type="search"
          // Toute la largeur.
          fullWidth
          // Le texte saisi.
          value={query}
          // À chaque frappe : met le texte à jour.
          onChange={(e) => setQuery(e.target.value)}
          // Gestion du clavier.
          onKeyDown={onKeyDown}
          // Texte indicatif, selon la recherche mondiale et la taille de l'écran.
          placeholder={worldSearch ? (compact ? 'Adresse, ville, planète, GPS…' : 'Une adresse, une ville du monde, une planète ou des coordonnées GPS…') : 'Une ville, une planète ou des coordonnées GPS…'}
          // Texte un peu plus grand.
          sx={{ fontSize: '1.05rem', py: 1 }}
          // Réglages des éléments internes (début).
          slotProps={{
            // Attributs de la balise input (début).
            input: {
              // Clavier de recherche, touche « Aller », sans saisie automatique ni correction.
              inputMode: 'search', enterKeyHint: 'go', autoComplete: 'off', autoCorrect: 'off', autoCapitalize: 'none', spellCheck: 'false',
              // Rôle de liste déroulante, reliée à la liste des résultats.
              role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'palette-list',
              // Désigne le résultat actif aux lecteurs d'écran.
              'aria-activedescendant': results[active] ? `pal-${active}` : undefined,
            // Fin des attributs.
            },
          // Fin des réglages.
          }}
        // Fin du champ.
        />
        {/* Pas de touche Échap sur mobile : bouton de fermeture visible. */}
        {/* En mode compact (début). */}
        {compact ? (
          // Un bouton « Annuler ».
          <Button onClick={onClose} aria-label="Fermer la recherche">Annuler</Button>
        // Sinon (début).
        ) : (
          // Un bouton en croix.
          <IconButton onClick={onClose} aria-label="Fermer la recherche"><CloseIcon /></IconButton>
        // Fin du choix.
        )}
      {/* Fin de la ligne. */}
      </Stack>
      {/* La liste des résultats, de hauteur limitée hors mode compact. */}
      <List id="palette-list" role="listbox" ref={listRef} dense sx={{ maxHeight: compact ? 'none' : '46vh', overflowY: 'auto', p: 0.75 }}>
        {/* Une ligne par résultat (début). */}
        {results.map((r, n) => (
          // La ligne (début de la balise).
          <ListItemButton
            // Clé unique : le type et le rang.
            key={`${r.type}-${r.i}`}
            // Identifiant utilisé par le champ pour désigner le résultat actif.
            id={`pal-${n}`}
            // Rôle d'option.
            role="option"
            // Sélectionnée, pour les lecteurs d'écran.
            aria-selected={n === active}
            // Sélectionnée, pour l'affichage.
            selected={n === active}
            // Au survol de la souris : devient le résultat actif.
            onPointerMove={(e) => { if (e.pointerType === 'mouse') setActive(n); }}
            // Au clic : choisit ce résultat.
            onClick={() => choose(r)}
            // Coins arrondis, 44 px de haut au moins.
            sx={{ borderRadius: 1.5, gap: 1.25, minHeight: 44 }}
          // Fin de la balise ouvrante.
          >
            {/* Vignette du type de résultat : largeur fixe, les noms restent alignés. */}
            {/* La vignette du type, de largeur fixe. */}
            <Box component="span" aria-hidden="true" sx={{ flex: 'none', width: 24, display: 'grid', placeItems: 'center', color: 'text.secondary' }}>{resultIconNode(r.type)}</Box>
            {/* Les textes (début de la balise). */}
            <ListItemText
              // Le nom.
              primary={r.name}
              // Le sous-titre.
              secondary={r.sub}
              // Nom et sous-titre aux deux extrémités.
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1.5, my: 0.25, minWidth: 0 }}
              // Sous-titre aligné à droite, sur 55 % de la largeur au plus.
              slotProps={{ secondary: { sx: { textAlign: 'right', flex: 'none', maxWidth: '55%' } } }}
            // Fin des textes.
            />
          {/* Fin de la ligne. */}
          </ListItemButton>
        // Fin des résultats.
        ))}
        {/* Aucun résultat, hors chargement : le message avec son dessin. */}
        {!results.length && world.status !== 'loading' && nothing(`Aucun résultat pour « ${query} ». Essayez un autre nom.`)}
        {/* Pendant la recherche mondiale : une ligne d'attente. */}
        {worldSearch && world.status === 'loading' && empty('Recherche des localités et des adresses du monde (OpenStreetMap)…')}
        {/* Recherche mondiale en erreur : une ligne qui le dit. */}
        {worldSearch && world.status === 'error' && empty('Recherche mondiale indisponible.')}
      {/* Fin de la liste. */}
      </List>
    {/* Fin de la boîte de dialogue. */}
    </Dialog>
  // Fin du rendu.
  );
// Fin de Rechercher.
}
