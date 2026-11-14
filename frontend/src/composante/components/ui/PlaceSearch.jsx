// Importe de React les crochets useEffect, useMemo et useState.
import { useEffect, useMemo, useState } from 'react';
// Importe de MUI les composants de liste, Paper (carte) et TextField (champ).
import { List, ListItem, ListItemButton, ListItemText, Paper, TextField } from '@mui/material';
// Importe coords, qui met en forme des coordonnées.
import { coords } from '@/moteur/lib/format';
// Importe la largeur de vue d'une adresse et fold, qui normalise un texte pour la comparaison.
import { ADDRESS_VIEW_M, fold } from '@/moteur/lib/search';
// Importe altitudeForView, qui donne l'altitude correspondant à une largeur de vue.
import { altitudeForView } from '@/moteur/engine/gps';

/**
 * Recherche dans les lieux d’un corps (villes, lieux lunaires, repères planétaires).
 * `onPick` absent : la liste reste informative (corps sans surface navigable).
 */
// Déclare et exporte le composant PlaceSearch : lieux, rappel de choix, texte indicatif, nombre maximal de résultats (8) et recherche distante.
export function PlaceSearch({ places, onPick, placeholder = 'Rechercher un lieu…', max = 8, remote = null }) {
  // État : le texte saisi.
  const [query, setQuery] = useState('');
  // État de la recherche distante : requête, résultats et statut.
  const [far, setFar] = useState({ q: '', items: [], status: 'idle' }); // résultats de la recherche distante
  // Requête normalisée, sans espaces autour.
  const q = fold(query.trim());

  // Recherche distante (toutes les localités du monde), après une courte pause de frappe.
  // Effet de la recherche distante.
  useEffect(() => {
    // Sans recherche distante ou avec moins de 2 caractères : remet l'état au repos et s'arrête.
    if (!remote || q.length < 2) { setFar({ q: '', items: [], status: 'idle' }); return undefined; }
    // Crée un contrôleur d'annulation.
    const ctrl = new AbortController();
    // Passe au statut « chargement », en gardant les résultats précédents.
    setFar((f) => ({ ...f, status: 'loading' }));
    // Programme la recherche après une pause.
    const t = setTimeout(() => {
      // Lance la recherche distante avec le texte saisi et le signal d'annulation.
      remote(query.trim(), ctrl.signal)
        // Réussite : mémorise la requête, les résultats et le statut « prêt ».
        .then((items) => setFar({ q, items, status: 'ready' }))
        // Échec, sauf annulation volontaire : aucun résultat et statut « erreur ».
        .catch((e) => { if (e.name !== 'AbortError') setFar({ q, items: [], status: 'error' }); });
    // Fin de la programmation ; pause de 300 ms.
    }, 300);
    // Nettoyage : annule la pause et la requête en cours.
    return () => { clearTimeout(t); ctrl.abort(); };
  // Fin de l'effet ; dépendances : la recherche distante et la requête normalisée (règle ESLint désactivée sur cette ligne).
  }, [remote, q]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calcul mémorisé des résultats.
  const results = useMemo(() => {
    // Sans requête, aucun résultat.
    if (!q) return [];
    // names : tous les noms d'un lieu (nom, nom local, variantes), normalisés.
    const names = (f) => [f.name, f.native, ...(f.alt || [])].filter(Boolean).map(fold);
    // Deux listes : les lieux dont un nom commence par la requête, et les autres.
    const starts = [], other = [];
    // Parcourt les lieux.
    for (const f of places) {
      // Les noms normalisés du lieu.
      const n = names(f);
      // Si un nom commence par la requête : première liste.
      if (n.some((k) => k.startsWith(q))) starts.push(f);
      // Sinon, si un nom, le type ou la description contient la requête : seconde liste.
      else if (n.some((k) => k.includes(q)) || (f.kind && fold(f.kind).includes(q)) || (f.info && fold(f.info).includes(q))) other.push(f);
      // S'arrête dès que la première liste est pleine.
      if (starts.length >= max) break;
    // Fin du parcours.
    }
    // Résultats locaux : les débuts de nom d'abord, limités au maximum.
    const local = [...starts, ...other].slice(0, max);
    // dup : vrai si un lieu distant a le même nom qu'un résultat local, à moins de 0,3° en latitude et en longitude.
    const dup = (p) => local.some((f) => fold(f.name) === fold(p.name) && Math.abs(f.lat - p.lat) < 0.3 && Math.abs(f.lon - p.lon) < 0.3);
    // Les résultats locaux, puis les lieux distants qui ne font pas doublon.
    return [...local, ...far.items.filter((p) => !dup(p))];
  // Fin du calcul ; dépendances : la requête, les lieux, le maximum et les résultats distants.
  }, [q, places, max, far.items]);

  // « address » est le type technique des adresses de la recherche mondiale : affiché en clair.
  // detail : ligne secondaire d'un résultat : type (« Adresse » pour une adresse), nom courant si un nom local est affiché, description, coordonnées…
  const detail = (f) => [f.kind === 'address' ? 'Adresse' : f.kind, f.native ? f.name : null, f.info, coords(f.lat, f.lon)]
    // … sans les éléments vides, séparés par un point médian.
    .filter(Boolean).join(' · ');

  // Déclare pick, appelé quand un résultat est choisi.
  const pick = (f) => {
    // Adresse (rue, numéro) : survolée de près.
    // Transmet le lieu au parent ; pour une adresse, ajoute l'altitude qui donne la vue rapprochée.
    onPick(f.kind === 'address' ? { ...f, altitudeM: altitudeForView(ADDRESS_VIEW_M) } : f);
    // Vide le champ de recherche.
    setQuery('');
  // Fin de pick.
  };

  // Début du rendu.
  return (
    // Fragment : regroupe le champ et la liste sans balise supplémentaire.
    <>
      {/* Le champ de recherche (début de la balise). */}
      <TextField
        // Type « recherche ».
        type="search"
        // Petite taille.
        size="small"
        // Toute la largeur.
        fullWidth
        // Le texte saisi.
        value={query}
        // À chaque frappe : met le texte à jour.
        onChange={(e) => setQuery(e.target.value)}
        // Gestion du clavier (début).
        onKeyDown={(e) => {
          // Entrée : choisit le premier résultat, si le choix est possible.
          if (e.key === 'Enter' && onPick && results[0]) pick(results[0]);
          // Échap : vide le champ.
          else if (e.key === 'Escape') setQuery('');
        // Fin de la gestion du clavier.
        }}
        // Texte indicatif.
        placeholder={placeholder}
        // Réglages des éléments internes du champ (début).
        slotProps={{
          // Attributs de la balise input (début).
          htmlInput: {
            // Nom pour les lecteurs d'écran, clavier de recherche, touche Entrée en « Rechercher ».
            'aria-label': placeholder, inputMode: 'search', enterKeyHint: 'search',
            // Pas de saisie automatique, de correction, de majuscule automatique ni de vérification orthographique.
            autoComplete: 'off', autoCorrect: 'off', autoCapitalize: 'none', spellCheck: 'false',
          // Fin des attributs de la balise input.
          },
        // Fin des réglages.
        }}
      // Fin du champ.
      />
      {/* S'il y a une requête (début). */}
      {q && (
        // Carte à contour, transparente, haute de 280 px au plus, qui défile.
        <Paper variant="outlined" sx={{ mt: 1, bgcolor: 'transparent', backdropFilter: 'none', maxHeight: 280, overflowY: 'auto' }}>
          {/* Liste dense, sans marge intérieure. */}
          <List dense disablePadding>
            {/* Une entrée par résultat (début). */}
            {results.map((f) => {
              // Deux lieux peuvent porter le même nom : la clé inclut les coordonnées.
              // Le texte de l'entrée : nom local ou nom courant, puis la ligne de détail.
              const text = <ListItemText primary={f.native || f.name} secondary={detail(f)} />;
              // Si le choix est possible (début).
              return onPick ? (
                // Entrée cliquable, à clé unique, avec la description ou les coordonnées en infobulle.
                <ListItemButton key={`${f.name}-${f.lat}-${f.lon}`} onClick={() => pick(f)} title={f.info || coords(f.lat, f.lon)}>
                  {/* Le texte de l'entrée. */}
                  {text}
                {/* Fin de l'entrée cliquable. */}
                </ListItemButton>
              // Sinon (début).
              ) : (
                // Entrée simple, non cliquable, avec la même clé et la même infobulle.
                <ListItem key={`${f.name}-${f.lat}-${f.lon}`} title={f.info || coords(f.lat, f.lon)}>{text}</ListItem>
              // Fin du choix entre les deux formes.
              );
            // Fin des entrées.
            })}
            {/* Pendant la recherche distante (début). */}
            {remote && far.status === 'loading' && (
              // Entrée d'information : recherche en cours.
              <ListItem><ListItemText secondary="Recherche de toutes les localités du monde…" /></ListItem>
            // Fin de l'entrée d'information.
            )}
            {/* S'il n'y a aucun résultat et aucune recherche en cours (début). */}
            {!results.length && far.status !== 'loading' && (
              // Entrée d'information : aucun lieu pour le texte saisi.
              <ListItem><ListItemText secondary={`Aucun lieu pour « ${query} ».`} /></ListItem>
            // Fin de l'entrée d'information.
            )}
          {/* Fin de la liste. */}
          </List>
        {/* Fin de la carte. */}
        </Paper>
      // Fin de la zone des résultats.
      )}
    {/* Fin du fragment. */}
    </>
  // Fin du rendu.
  );
// Fin de PlaceSearch.
}
