// Importe de React les crochets useCallback, useEffect, useMemo, useRef et useState.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// Importe get, la requête GET du client de l'API.
import { get } from '@/moteur/api/client';
// Importe les catégories, les lunes, les planètes et les astres d'une catégorie, la recherche d'images, la pleine résolution et les téléchargements.
import { CATEGORIES, MOONS, planetsOf, bodiesOf, searchImages, fullResolution, downloadImage, downloadGalleryZip, collectPlanetImages } from './galerieData';
// Importe la vue « Ma collection ».
import { Collection } from './Collection';
// Importe la feuille de style de la galerie.
import './galerie.css';
// Icônes de téléchargement, d'arrêt, de fermeture et de lien externe.
import { CloseIcon, DownloadIcon, OpenInNewIcon, StopIcon } from '../../ui/icons';

// key : clé du cache pour une planète, un astre et une mission.
const key = (p, b, m) => `${p}:${b}:${m}`;
// fmtDate : écrit une date en français…
const fmtDate = (iso) =>
  // … année, mois abrégé et jour ; chaîne vide sans date.
  iso ? new Date(iso).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' }) : '';

/**
 * Galerie : images NASA (images-api.nasa.gov, sans clé) des planètes, planètes géantes, planètes naines et de leurs
 * satellites, par mission. Quatre catégories séparées (voir CATEGORIES). Intégrée telle quelle dans la fenêtre « Galerie » (voir Galerie.jsx) ; ses styles sont
 * limités au conteneur .gobai-gallery. `onLightboxChange(ouverte)` prévient la fenêtre quand la visionneuse s'ouvre.
 * Deux vues : les archives NASA en direct, et « Ma collection » (photos et vidéos personnelles, voir Collection.jsx).
 */
// Déclare et exporte le composant GalerieApp : reçoit le rappel de la visionneuse.
export function GalerieApp({ onLightboxChange }) {
  // État : la catégorie affichée, les géantes au départ.
  const [categoryId, setCategoryId] = useState('geantes');
  // État : la vue affichée, les archives NASA au départ.
  const [view, setView] = useState('nasa');
  // État : la collection personnelle, null tant qu'elle n'est pas chargée.
  const [collection, setCollection] = useState(null); // { storage, total, folders } | { error }

  // Effet exécuté une seule fois : charge la collection.
  useEffect(() => {
    // Crée un contrôleur d'annulation.
    const ctrl = new AbortController();
    // Demande la collection à l'API.
    get('/galerie', { signal: ctrl.signal })
      // Réussite : la garde.
      .then(setCollection)
      // Échec, sauf annulation volontaire : garde le message de l'erreur.
      .catch((e) => { if (e.name !== 'AbortError') setCollection({ error: e.message }); });
    // Nettoyage : annule la requête en cours.
    return () => ctrl.abort();
  // Fin de l'effet ; aucune dépendance.
  }, []);

  // La catégorie affichée.
  const category = CATEGORIES.find((c) => c.id === categoryId);
  // mine : nombre de médias de la collection dans une catégorie.
  const mine = (id) => (collection?.folders ?? []).filter((f) => f.category === id).reduce((n, f) => n + f.items.length, 0);

  // Début du rendu.
  return (
    // Fragment : regroupe le choix de catégorie et la vue.
    <>
      {/* Conteneur qui porte les styles de la galerie. */}
      <div className="gobai-gallery">
        {/* Bloc du choix. */}
        <div className="cat-wrap">
          {/* La barre des catégories. */}
          <nav className="cats" aria-label="Catégories d'astres">
            {/* Un bouton par catégorie (début). */}
            {CATEGORIES.map((c) => {
              // Les planètes de la catégorie.
              const list = planetsOf(c.id);
              // Nombre d'astres : le total des lunes pour les satellites, le nombre de planètes sinon.
              const bodies = c.id === 'satellites' ? list.reduce((n, p) => n + MOONS[p.id].length, 0) : list.length;
              // Début du rendu du bouton.
              return (
                // Le bouton, actif si c'est la catégorie affichée, avec sa couleur en variable CSS (début de la balise).
                <button key={c.id} className={`cat ${c.id === categoryId ? 'is-active' : ''}`} style={{ '--c': c.color }}
                  // Au clic : affiche la catégorie ; état enfoncé pour les lecteurs d'écran.
                  onClick={() => setCategoryId(c.id)} aria-pressed={c.id === categoryId}>
                  {/* Les pastilles décoratives de la catégorie. */}
                  <span className={`cat-orbs cat-orbs-${c.id}`} aria-hidden="true">
                    {/* Une pastille par planète, cinq au plus, à sa couleur. */}
                    {list.slice(0, 5).map((p) => <i key={p.id} style={{ '--o': p.color }} />)}
                  {/* Fin des pastilles. */}
                  </span>
                  {/* Le nom de la catégorie. */}
                  <span className="cat-name">{c.name}</span>
                  {/* Son sous-titre. */}
                  <span className="cat-sub">{c.sub}</span>
                  {/* Sa ligne de décompte (début de la balise). */}
                  <span className="cat-meta">
                    {/* Le nombre de lunes ou d'astres et, si la collection est chargée, le nombre de médias personnels. */}
                    {bodies} {c.id === 'satellites' ? 'lunes' : 'astres'}{collection?.folders ? ` · ${mine(c.id)} dans ma collection` : ''}
                  {/* Fin de la ligne de décompte. */}
                  </span>
                {/* Fin du bouton. */}
                </button>
              // Fin du rendu du bouton.
              );
            // Fin des boutons.
            })}
          {/* Fin de la barre des catégories. */}
          </nav>
          {/* La barre des vues. */}
          <nav className="views" aria-label="Vue de la galerie">
            {/* Bouton « Archives NASA », actif si c'est la vue affichée. */}
            <button className={`view-tab ${view === 'nasa' ? 'is-active' : ''}`} onClick={() => setView('nasa')} aria-pressed={view === 'nasa'}>
              {/* Son libellé. */}
              Archives NASA
            {/* Fin du bouton. */}
            </button>
            {/* Bouton « Ma collection », actif si c'est la vue affichée. */}
            <button className={`view-tab ${view === 'collection' ? 'is-active' : ''}`} onClick={() => setView('collection')} aria-pressed={view === 'collection'}>
              {/* Son libellé. */}
              Ma collection
            {/* Fin du bouton. */}
            </button>
          {/* Fin de la barre des vues. */}
          </nav>
        {/* Fin du bloc du choix. */}
        </div>
      {/* Fin du conteneur. */}
      </div>
      {/* Selon la vue… */}
      {view === 'nasa'
        // … les archives NASA de la catégorie, recréées à chaque changement de catégorie…
        ? <NasaGalerie key={category.id} category={category} onLightboxChange={onLightboxChange} />
        // … ou la collection personnelle de la catégorie.
        : <Collection key={category.id} category={category} data={collection} onLightboxChange={onLightboxChange} />}
    {/* Fin du fragment. */}
    </>
  // Fin du rendu.
  );
// Fin de GalerieApp.
}

// Déclare le composant NasaGalerie : la catégorie et le rappel de la visionneuse.
function NasaGalerie({ category, onLightboxChange }) {
  // Les planètes de la catégorie.
  const planets = useMemo(() => planetsOf(category.id), [category]);
  // Vrai pour la catégorie des satellites.
  const moonsOnly = category.id === 'satellites'; // catégorie « Satellites » : seulement les lunes, jamais la planète
  // État : la planète affichée, la première au départ.
  const [planetId, setPlanetId] = useState(planets[0].id);
  // État : l'astre affiché : toutes les lunes pour les satellites, la planète sinon.
  const [bodyId, setBodyId] = useState(moonsOnly ? 'moons' : planets[0].id); // id planète, 'moons' ou id d'une lune
  // État : la mission affichée, toutes au départ.
  const [missionId, setMissionId] = useState('all');
  // État : l'ordre de tri, croissant au départ.
  const [sort, setSort] = useState('asc');
  // État : le cache des images, par clé.
  const [cache, setCache] = useState({}); // key -> { images, page, hasMore, loading, error }
  // État : l'image ouverte dans la visionneuse, null s'il n'y en a pas.
  const [open, setOpen] = useState(null); // index dans `images`
  // Référence : le cache courant, lisible depuis les effets.
  const cacheRef = useRef(cache);
  // Mise à jour à chaque rendu.
  cacheRef.current = cache;

  // Prévient le parent quand la visionneuse s'ouvre ou se ferme.
  useEffect(() => { onLightboxChange?.(open != null); }, [open, onLightboxChange]);

  // La planète affichée.
  const planet = planets.find((p) => p.id === planetId);
  // Ses astres : elle-même et ses lunes.
  const bodies = useMemo(() => bodiesOf(planet), [planet]);
  // Ses lunes seulement.
  const moons = bodies.filter((b) => b.kind === 'moon');
  // Astres actifs (début du calcul mémorisé).
  const activeBodies = useMemo(
    // Toutes les lunes, ou l'astre choisi.
    () => (bodyId === 'moons' ? bodies.filter((b) => b.kind === 'moon') : bodies.filter((b) => b.id === bodyId)),
    // Dépendances : les astres et l'astre choisi.
    [bodies, bodyId]
  // Fin du calcul.
  );
  // Missions actives (début du calcul mémorisé).
  const activeMissions = useMemo(
    // Toutes celles de la planète, ou la mission choisie.
    () => (missionId === 'all' ? planet.missions : planet.missions.filter((m) => m.id === missionId)),
    // Dépendances : la planète et la mission choisie.
    [planet, missionId]
  // Fin du calcul.
  );
  // Toutes les combinaisons (corps × mission) affichées.
  // Couples astre et mission (début du calcul mémorisé).
  const pairs = useMemo(
    // Chaque astre actif avec chaque mission active.
    () => activeBodies.flatMap((b) => activeMissions.map((m) => ({ b, m }))),
    // Dépendances : les astres et les missions actifs.
    [activeBodies, activeMissions]
  // Fin du calcul.
  );

  // load : charge une page d'images (début de la fonction mémorisée).
  const load = useCallback(
    // Fonction asynchrone : l'astre, la mission et le numéro de page.
    async (body, mission, page) => {
      // La clé du cache.
      const k = key(planet.id, body.id, mission.id);
      // Marque l'entrée comme en chargement, en la créant vide si elle n'existe pas.
      setCache((c) => ({ ...c, [k]: { ...(c[k] ?? { images: [], page: 0, hasMore: true }), loading: true, error: null } }));
      // Début du bloc protégé.
      try {
        // Cherche les images et attend.
        const res = await searchImages(planet, body, mission, page);
        // Met le cache à jour (début).
        setCache((c) => ({
          // Garde les autres entrées.
          ...c,
          // Ajoute les images à celles de l'entrée, avec la page, la suite éventuelle et la fin du chargement.
          [k]: { images: [...(c[k]?.images ?? []), ...res.images], page, hasMore: res.hasMore, loading: false, error: null },
        // Fin de la mise à jour.
        }));
      // En cas d'échec.
      } catch (e) {
        // Garde l'entrée, sans chargement, avec le message de l'erreur.
        setCache((c) => ({ ...c, [k]: { ...c[k], loading: false, error: e.message } }));
      // Fin du bloc.
      }
    // Fin de la fonction.
    },
    // Dépendance : la planète.
    [planet]
  // Fin de load.
  );

  // Charge la première page des missions affichées si absente.
  // Effet qui charge les premières pages manquantes.
  useEffect(() => {
    // Pour chaque couple.
    pairs.forEach(({ b, m }) => {
      // Si le cache n'a rien pour ce couple, charge sa première page.
      if (!cacheRef.current[key(planet.id, b.id, m.id)]) load(b, m, 1);
    // Fin du parcours.
    });
  // Fin de l'effet ; dépendances : la planète, les couples et load.
  }, [planet, pairs, load]);

  // Chaque couple, avec son entrée du cache.
  const entries = pairs.map(({ b, m }) => ({ b, m, s: cache[key(planet.id, b.id, m.id)] }));
  // Vrai si une entrée est en chargement.
  const loading = entries.some((e) => e.s?.loading);
  // Vrai si une entrée a une suite et n'est pas en chargement.
  const canLoadMore = entries.some((e) => e.s && !e.s.loading && e.s.hasMore);
  // Les entrées en erreur.
  const errors = entries.filter((e) => e.s?.error);

  // Images affichées (début du calcul mémorisé).
  const images = useMemo(() => {
    // Identifiants déjà vus.
    const seen = new Set();
    // Liste finale.
    const all = [];
    // Pour chaque entrée…
    entries.forEach(({ s }) =>
      // … et chaque image de l'entrée (aucune à défaut).
      (s?.images ?? []).forEach((img) => {
        // Si l'image n'est pas déjà dans la liste.
        if (!seen.has(img.id)) {
          // Note son identifiant.
          seen.add(img.id);
          // L'ajoute.
          all.push(img);
        // Fin du cas.
        }
      // Fin du parcours des images.
      })
    // Fin du parcours des entrées.
    );
    // Trie par date, dans l'ordre choisi.
    all.sort((a, b) => (sort === 'asc' ? 1 : -1) * (new Date(a.date) - new Date(b.date)));
    // Renvoie la liste.
    return all;
  // Fin du calcul ; dépendances : le cache, la planète, les couples et le tri (règle ESLint désactivée par la ligne suivante).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cache, planet, pairs, sort]);

  // Nombre d'images chargées par mission, pour les corps sélectionnés.
  // Nombre d'images par mission (début du calcul mémorisé).
  const counts = useMemo(() => {
    // Table : mission → nombre.
    const out = {};
    // Pour chaque mission de la planète.
    planet.missions.forEach((m) => {
      // Les entrées du cache déjà chargées pour les astres actifs.
      const loaded = activeBodies.map((b) => cache[key(planet.id, b.id, m.id)]).filter(Boolean);
      // Leur total d'images ; indéfini si rien n'est chargé.
      out[m.id] = loaded.length ? loaded.reduce((n, s) => n + s.images.length, 0) : undefined;
    // Fin du parcours.
    });
    // Renvoie la table.
    return out;
  // Fin du calcul ; dépendances : le cache, la planète et les astres actifs.
  }, [cache, planet, activeBodies]);

  // loadMore : charge la page suivante…
  const loadMore = () =>
    // … pour chaque entrée…
    entries.forEach(({ b, m, s }) => {
      // … qui a une suite et n'est pas en chargement.
      if (s && !s.loading && s.hasMore) load(b, m, s.page + 1);
    // Fin de loadMore.
    });

  // Déclare choosePlanet : change de planète.
  const choosePlanet = (id) => {
    // Enregistre la planète.
    setPlanetId(id);
    // Revient à toutes ses lunes, ou à la planète elle-même.
    setBodyId(moonsOnly ? 'moons' : id);
    // Revient à toutes les missions.
    setMissionId('all');
    // Ferme la visionneuse.
    setOpen(null);
  // Fin de choosePlanet.
  };

  // Début du rendu.
  return (
    // Conteneur qui porte les styles de la galerie.
    <div className="gobai-gallery">
    {/* Conteneur de l'application, avec la couleur de la planète en variable CSS. */}
    <div className="app" style={{ '--planet': planet.color }}>
      {/* L'en-tête. */}
      <header className="masthead">
        {/* Bloc du titre. */}
        <div className="brand">
          {/* Le surtitre. */}
          <span className="eyebrow">Archives NASA · images-api.nasa.gov</span>
          {/* Le titre de la catégorie. */}
          <h1>{category.title}</h1>
        {/* Fin du bloc du titre. */}
        </div>
        {/* La barre des planètes. */}
        <nav className="planets" aria-label="Planètes">
          {/* Un élément par planète (début). */}
          {planets.map((p) => (
            // Conteneur du bouton et du téléchargement.
            <span key={p.id} className="planet-wrap">
              {/* Le bouton de la planète (début de la balise). */}
              <button
                // Actif si c'est la planète affichée.
                className={`planet ${p.id === planetId ? 'is-active' : ''}`}
                // Sa couleur en variable CSS.
                style={{ '--c': p.color }}
                // Au clic : affiche la planète.
                onClick={() => choosePlanet(p.id)}
                // État enfoncé pour les lecteurs d'écran.
                aria-pressed={p.id === planetId}
              // Fin de la balise ouvrante.
              >
                {/* La pastille de la planète, décorative. */}
                <span className="orb" aria-hidden="true" />
                {/* Son nom. */}
                <span className="planet-name">{p.name}</span>
                {/* Sa distance. */}
                <span className="planet-dist">{p.distance}</span>
              {/* Fin du bouton. */}
              </button>
              {/* Le bouton de téléchargement de toutes ses images. */}
              <PlanetZipButton planet={p} />
            {/* Fin du conteneur. */}
            </span>
          // Fin des éléments.
          ))}
        {/* Fin de la barre des planètes. */}
        </nav>
      {/* Fin de l'en-tête. */}
      </header>


      {/* Pour la catégorie des satellites (début). */}
      {moonsOnly && (
        // La barre des satellites.
        <section className="bodies" aria-label="Satellites">
          {/* Bouton « Tous » (début de la balise). */}
          <button
            // Actif si toutes les lunes sont affichées.
            className={`body-tab ${bodyId === 'moons' ? 'is-active' : ''}`}
            // Au clic : affiche toutes les lunes et ferme la visionneuse.
            onClick={() => { setBodyId('moons'); setOpen(null); }}
          // Fin de la balise ouvrante.
          >
            {/* Le libellé : « Satellites de » suivi du nom de la planète. */}
            <span className="body-kind">Satellites de {planet.name}</span>
            {/* « Tous », avec le nombre de lunes. */}
            Tous ({moons.length})
          {/* Fin du bouton. */}
          </button>
          {/* Un bouton par lune (début). */}
          {moons.map((b) => (
            // Le bouton (début de la balise).
            <button
              // Clé unique : l'identifiant de la lune.
              key={b.id}
              // Actif si c'est la lune affichée.
              className={`body-tab moon ${bodyId === b.id ? 'is-active' : ''}`}
              // Au clic : affiche cette lune et ferme la visionneuse.
              onClick={() => { setBodyId(b.id); setOpen(null); }}
            // Fin de la balise ouvrante.
            >
              {/* Le nom de la lune. */}
              {b.name}
            {/* Fin du bouton. */}
            </button>
          // Fin des boutons.
          ))}
        {/* Fin de la barre des satellites. */}
        </section>
      // Fin du cas.
      )}

      {/* La barre de filtres. */}
      <section className="toolbar">
        {/* Le groupe des missions. */}
        <div className="missions" role="group" aria-label="Missions">
          {/* Bouton « Toutes », actif si toutes les missions sont affichées. */}
          <button className={`chip ${missionId === 'all' ? 'is-active' : ''}`} onClick={() => setMissionId('all')}>
            {/* Son libellé. */}
            Toutes
          {/* Fin du bouton. */}
          </button>
          {/* Un bouton par mission (début). */}
          {planet.missions.map((m) => (
            // Le bouton (début de la balise).
            <button
              // Clé unique : l'identifiant de la mission.
              key={m.id}
              // Actif si c'est la mission affichée.
              className={`chip ${missionId === m.id ? 'is-active' : ''}`}
              // Au clic : affiche cette mission.
              onClick={() => setMissionId(m.id)}
            // Fin de la balise ouvrante.
            >
              {/* Le nom de la mission. */}
              {m.name}
              {/* Son année. */}
              <span className="chip-meta">{m.year}</span>
              {/* Le nombre d'images chargées, s'il est connu. */}
              {counts[m.id] != null && <span className="chip-count">{counts[m.id]}</span>}
            {/* Fin du bouton. */}
            </button>
          // Fin des boutons.
          ))}
        {/* Fin du groupe des missions. */}
        </div>
        {/* Le choix du tri. */}
        <label className="sort">
          {/* Son libellé. */}
          <span>Tri</span>
          {/* La liste déroulante ; un changement met le tri à jour. */}
          <select id="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            {/* Ordre chronologique. */}
            <option value="asc">Chronologique</option>
            {/* Les plus récentes d'abord. */}
            <option value="desc">Plus récentes</option>
          {/* Fin de la liste déroulante. */}
          </select>
        {/* Fin du choix du tri. */}
        </label>
      {/* Fin de la barre de filtres. */}
      </section>

      {/* S'il y a des erreurs (début). */}
      {errors.length > 0 && (
        // Message d'erreur (début de la balise).
        <p className="notice">
          {/* Les couples astre et mission en échec, sans doublon, et une invitation à réessayer. */}
          Impossible de charger {[...new Set(errors.map((e) => `${e.b.name} · ${e.m.name}`))].join(', ')} : l'API NASA n'a pas répondu. Réessaie dans un instant.
        {/* Fin du message. */}
        </p>
      // Fin du cas.
      )}

      {/* La grille des images. */}
      <main className="grid">
        {/* Une vignette par image (début). */}
        {images.map((img, i) => (
          // La vignette ; un clic l'ouvre dans la visionneuse.
          <figure key={img.id} className="tile" onClick={() => setOpen(i)}>
            {/* L'image réduite, chargée à l'approche. */}
            <img src={img.thumb} alt={img.title} loading="lazy" />
            {/* Le bouton de téléchargement. */}
            <DownloadButton image={img} className="tile-dl" label="⤓" />
            {/* La légende. */}
            <figcaption>
              {/* L'astre et la mission. */}
              <span className="tile-mission">{img.bodyName} · {img.missionName}</span>
              {/* Le titre, jamais traduit. */}
              <span className="tile-title" translate="no">{img.title}</span>
              {/* La date. */}
              <span className="tile-date">{fmtDate(img.date)}</span>
            {/* Fin de la légende. */}
            </figcaption>
          {/* Fin de la vignette. */}
          </figure>
        // Fin des vignettes.
        ))}
        {/* Pendant un chargement… */}
        {loading &&
          // … des vignettes vides : 4 s'il y a déjà des images, 12 sinon.
          Array.from({ length: images.length ? 4 : 12 }).map((_, i) => <div key={`sk${i}`} className="tile skeleton" />)}
      {/* Fin de la grille. */}
      </main>

      {/* Sans chargement, sans image et sans erreur (début). */}
      {!loading && images.length === 0 && errors.length === 0 && (
        // Un message : aucune image trouvée.
        <p className="empty">Aucune image trouvée pour cette combinaison.</p>
      // Fin du cas.
      )}

      {/* Le pied de page. */}
      <footer className="foot">
        {/* Le nombre d'images et ce qui est affiché : les satellites de la planète, ou l'astre. */}
        <span className="count">{images.length} images · {bodyId === 'moons' ? `satellites de ${planet.name}` : activeBodies[0]?.name}</span>
        {/* Le bouton de téléchargement de la galerie, avec le nom du fichier. */}
        <ZipButton images={images} name={`galerie_${bodyId === 'moons' ? `satellites_${planet.name}` : activeBodies[0]?.name || 'nasa'}`} />
        {/* S'il reste des images à charger (début). */}
        {canLoadMore && (
          // Bouton « Charger plus », désactivé pendant un chargement.
          <button className="more" onClick={loadMore} disabled={loading}>
            {/* Son libellé. */}
            Charger plus
          {/* Fin du bouton. */}
          </button>
        // Fin du cas.
        )}
      {/* Fin du pied de page. */}
      </footer>

      {/* Si une image est ouverte et existe (début). */}
      {open != null && images[open] && (
        // La visionneuse (début de la balise).
        <Lightbox
          // L'image.
          image={images[open]}
          // Son rang.
          index={open}
          // Le nombre d'images.
          total={images.length}
          // Fermeture.
          onClose={() => setOpen(null)}
          // Navigation : avance ou recule en boucle.
          onNav={(d) => setOpen((i) => (i + d + images.length) % images.length)}
        // Fin de la visionneuse.
        />
      // Fin du cas.
      )}
    {/* Fin du conteneur de l'application. */}
    </div>
    {/* Fin du conteneur. */}
    </div>
  // Fin du rendu.
  );
// Fin de NasaGalerie.
}

/**
 * Bouton .zip d'une planète : cherche toutes ses images (chaque mission) puis les enregistre en un seul fichier.
 * Second clic = annuler.
 */
// Déclare le composant PlanetZipButton : reçoit la planète.
function PlanetZipButton({ planet }) {
  // État : rien, recherche en cours, progression ou message final.
  const [state, setState] = useState(null); // null | 'search' | { done, total } | message
  // Référence : le contrôleur d'annulation du téléchargement en cours.
  const ctrl = useRef(null);
  // Occupé pendant la recherche ou le téléchargement.
  const busy = state === 'search' || (state && typeof state === 'object');
  // Déclare start, appelé au clic.
  const start = async (e) => {
    // Le clic ne remonte pas au bouton de la planète.
    e.stopPropagation();
    // Téléchargement en cours : ce clic l'annule.
    if (ctrl.current) { ctrl.current.abort(); return; }
    // Crée un contrôleur d'annulation.
    ctrl.current = new AbortController();
    // Son signal.
    const { signal } = ctrl.current;
    // Passe à l'état « recherche ».
    setState('search');
    // Début du bloc protégé.
    try {
      // Cherche toutes les images de la planète.
      const imgs = await collectPlanetImages(planet, signal);
      // Aucune image : erreur.
      if (!imgs.length) throw new Error('aucune image');
      // Passe à la progression, à zéro.
      setState({ done: 0, total: imgs.length });
      // Télécharge les images dans un fichier .zip, en mettant la progression à jour.
      const r = await downloadGalleryZip(imgs, `galerie_${planet.name}`, { signal, onProgress: (done, total) => setState({ done, total }) });
      // Affiche le nombre d'images téléchargées.
      setState(`${r.count} images`);
    // En cas d'échec.
    } catch (err) {
      // Affiche « annulé » ou « échec ».
      setState(err.name === 'AbortError' ? 'annulé' : 'échec');
    // Dans tous les cas.
    } finally {
      // Oublie le contrôleur.
      ctrl.current = null;
      // Après 4 secondes, efface le message final.
      setTimeout(() => setState((s) => (typeof s === 'string' && s !== 'search' ? null : s)), 4000);
    // Fin du bloc.
    }
  // Fin de start.
  };
  // Libellé du bouton : points de suspension, progression, message final ou « ⤓ zip ».
  const label = state === 'search' ? '…' : state && typeof state === 'object' ? `${state.done}/${state.total}` : state || '⤓ zip';
  // Début du rendu.
  return (
    // Le bouton, marqué occupé s'il y a lieu (début de la balise).
    <button type="button" className={`planet-zip ${busy ? 'is-busy' : ''}`} onClick={start}
      // Son infobulle : « Annuler » pendant le travail, l'explication sinon.
      title={busy ? 'Annuler' : `Télécharger toutes les images de ${planet.name} en .zip`}
      // Son nom pour les lecteurs d'écran.
      aria-label={`Télécharger les images de ${planet.name} en zip`}>
      {/* Son libellé. */}
      {label}
    {/* Fin du bouton. */}
    </button>
  // Fin du rendu.
  );
// Fin de PlanetZipButton.
}

/** Bouton « Télécharger la galerie » : toutes les images affichées dans un seul .zip (annulable). */
// Déclare le composant ZipButton : les images et le nom du fichier.
function ZipButton({ images, name }) {
  // État : la progression, null hors téléchargement.
  const [progress, setProgress] = useState(null); // { done, total } pendant le téléchargement
  // État : le message final.
  const [msg, setMsg] = useState('');
  // Référence : le contrôleur d'annulation du téléchargement en cours.
  const ctrl = useRef(null);
  // Déclare start, appelé au clic.
  const start = async () => {
    // Téléchargement en cours : ce clic l'annule.
    if (ctrl.current) { ctrl.current.abort(); return; } // second clic = annuler
    // Crée un contrôleur d'annulation.
    ctrl.current = new AbortController();
    // Efface le message.
    setMsg('');
    // Passe à la progression, à zéro.
    setProgress({ done: 0, total: images.length });
    // Début du bloc protégé.
    try {
      // Télécharge les images dans un fichier .zip (début de l'appel).
      const r = await downloadGalleryZip(images, name, {
        // Le signal d'annulation.
        signal: ctrl.current.signal,
        // La mise à jour de la progression.
        onProgress: (done, total) => setProgress({ done, total }),
      // Fin de l'appel.
      });
      // Message final : le nombre d'images, et celles qui ont échoué s'il y en a.
      setMsg(r.failed ? `${r.count} images · ${r.failed} non téléchargées` : `${r.count} images enregistrées`);
    // En cas d'échec.
    } catch (e) {
      // Message : téléchargement annulé, ou échec avec sa cause.
      setMsg(e.name === 'AbortError' ? 'Téléchargement annulé' : `Échec : ${e.message}`);
    // Dans tous les cas.
    } finally {
      // Oublie le contrôleur.
      ctrl.current = null;
      // Efface la progression.
      setProgress(null);
    // Fin du bloc.
    }
  // Fin de start.
  };
  // Début du rendu.
  return (
    // Conteneur du bouton et du message.
    <span className="zip">
      {/* Le bouton, désactivé sans image (début de la balise). */}
      <button type="button" className="more zip-btn" onClick={start} disabled={!images.length}
        // Son infobulle : « Annuler » pendant le téléchargement, l'explication sinon.
        title={progress ? 'Annuler' : 'Télécharger toutes les images affichées en un fichier .zip'}>
        {/* Son libellé : la progression, ou l'invitation à télécharger. */}
        {progress
          // Pendant le téléchargement : l'icône d'arrêt et la progression.
          ? <><StopIcon fontSize="inherit" /> {progress.done}/{progress.total}…</>
          // Sinon : l'icône de téléchargement et l'invitation.
          : <><DownloadIcon fontSize="inherit" /> Télécharger la galerie (.zip)</>}
      {/* Fin du bouton. */}
      </button>
      {/* Le message final, s'il y en a un. */}
      {msg && <span className="zip-msg">{msg}</span>}
    {/* Fin du conteneur. */}
    </span>
  // Fin du rendu.
  );
// Fin de ZipButton.
}

/** Bouton « Télécharger » : image en pleine résolution, sans ouvrir la visionneuse. */
// Déclare le composant DownloadButton : l'image, la classe CSS et le libellé.
function DownloadButton({ image, className, label }) {
  // État : téléchargement en cours ou non.
  const [busy, setBusy] = useState(false);
  // Déclare onClick, appelé au clic.
  const onClick = async (e) => {
    // Le clic ne remonte pas à la vignette.
    e.stopPropagation();
    // Téléchargement en cours : rien à faire.
    if (busy) return;
    // Note que le téléchargement commence.
    setBusy(true);
    // Télécharge l'image ; dans tous les cas, note la fin.
    try { await downloadImage(image); } finally { setBusy(false); }
  // Fin de onClick.
  };
  // Début du rendu.
  return (
    // Le bouton, désactivé pendant le téléchargement (début de la balise).
    <button type="button" className={className} onClick={onClick} disabled={busy}
      // Son nom pour les lecteurs d'écran et son infobulle.
      aria-label={`Télécharger ${image.title}`} title="Télécharger l'image en pleine résolution">
      {/* Des points de suspension pendant le téléchargement, le libellé sinon. */}
      {busy ? '…' : label}
    {/* Fin du bouton. */}
    </button>
  // Fin du rendu.
  );
// Fin de DownloadButton.
}

// Déclare le composant Lightbox : l'image, son rang, le total, la fermeture et la navigation.
function Lightbox({ image, index, total, onClose, onNav }) {
  // État : l'adresse affichée, la vignette au départ.
  const [src, setSrc] = useState(image.thumb);

  // Effet relancé quand l'image change.
  useEffect(() => {
    // Drapeau : faux une fois l'effet nettoyé.
    let alive = true;
    // Affiche d'abord la vignette.
    setSrc(image.thumb);
    // Demande la pleine résolution, puis l'affiche si l'effet est toujours actif.
    fullResolution(image).then((u) => alive && setSrc(u));
    // Fonction de nettoyage.
    return () => {
      // Les réponses tardives seront ignorées.
      alive = false;
    // Fin de la fonction de nettoyage.
    };
  // Fin de l'effet ; dépendance : l'image.
  }, [image]);

  // Effet des raccourcis clavier.
  useEffect(() => {
    // Déclare onKey, appelé à chaque touche enfoncée.
    const onKey = (e) => {
      // Échap : ferme.
      if (e.key === 'Escape') onClose();
      // Flèche droite : image suivante.
      if (e.key === 'ArrowRight') onNav(1);
      // Flèche gauche : image précédente.
      if (e.key === 'ArrowLeft') onNav(-1);
    // Fin de onKey.
    };
    // Écoute les touches sur toute la fenêtre.
    window.addEventListener('keydown', onKey);
    // Nettoyage : retire l'écouteur.
    return () => window.removeEventListener('keydown', onKey);
  // Fin de l'effet ; dépendances : les deux rappels.
  }, [onClose, onNav]);

  // Début du rendu.
  return (
    // Le fond de la visionneuse, au rôle de dialogue modal ; un clic dessus ferme.
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={image.title} onClick={onClose}>
      {/* Le corps ; un clic dedans ne ferme pas. */}
      <div className="lb-body" onClick={(e) => e.stopPropagation()}>
        {/* La scène. */}
        <div className="lb-stage">
          {/* L'image. */}
          <img src={src} alt={image.title} />
          {/* Bouton « précédente ». */}
          <button className="lb-nav prev" onClick={() => onNav(-1)} aria-label="Image précédente">‹</button>
          {/* Bouton « suivante ». */}
          <button className="lb-nav next" onClick={() => onNav(1)} aria-label="Image suivante">›</button>
        {/* Fin de la scène. */}
        </div>
        {/* Le volet d'informations. */}
        <aside className="lb-info">
          {/* Sa ligne du haut. */}
          <div className="lb-top">
            {/* L'astre et la mission. */}
            <span className="tile-mission">{image.bodyName} · {image.missionName}</span>
            {/* Le bouton de fermeture. */}
            <button className="lb-close" onClick={onClose} aria-label="Fermer"><CloseIcon fontSize="inherit" /></button>
          {/* Fin de la ligne du haut. */}
          </div>
          {/* Le titre, jamais traduit. */}
          <h2 translate="no">{image.title}</h2>
          {/* La liste des caractéristiques. */}
          <dl>
            {/* L'objet : planète ou satellite naturel. */}
            <div><dt>Objet</dt><dd>{image.bodyKind === 'planet' ? 'Planète' : 'Satellite naturel'}</dd></div>
            {/* La date. */}
            <div><dt>Date</dt><dd>{fmtDate(image.date)}</dd></div>
            {/* L'identifiant de la NASA. */}
            <div><dt>ID NASA</dt><dd>{image.id}</dd></div>
            {/* Le centre de la NASA, s'il est connu. */}
            {image.center && <div><dt>Centre</dt><dd>{image.center}</dd></div>}
            {/* La position dans la série. */}
            <div><dt>Position</dt><dd>{index + 1} / {total}</dd></div>
          {/* Fin de la liste. */}
          </dl>
          {/* La description, sans ses balises HTML, jamais traduite. */}
          <p className="lb-desc" translate="no">{image.description.replace(/<[^>]+>/g, '')}</p>
          {/* Les actions. */}
          <div className="lb-actions">
            {/* Le bouton de téléchargement de l'image. */}
            <DownloadButton image={image} className="lb-dl" label={<><DownloadIcon fontSize="inherit" /> Télécharger l’image</>} />
            {/* Le lien vers la page de l'image, ouvert dans un nouvel onglet. */}
            <a className="lb-link" href={`https://images.nasa.gov/details/${image.id}`} target="_blank" rel="noreferrer">
              {/* Son libellé. */}
              Voir sur images.nasa.gov <OpenInNewIcon fontSize="inherit" />
            {/* Fin du lien. */}
            </a>
          {/* Fin des actions. */}
          </div>
        {/* Fin du volet d'informations. */}
        </aside>
      {/* Fin du corps. */}
      </div>
    {/* Fin du fond de la visionneuse. */}
    </div>
  // Fin du rendu.
  );
// Fin de Lightbox.
}
