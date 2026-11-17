// Importe de React les crochets useEffect, useMemo et useState.
import { useEffect, useMemo, useState } from 'react';
// Importe de MUI Box, Checkbox, Chip, CircularProgress, Stack et Typography.
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Stack, TextField, Typography } from '@mui/material';
// Importe la lecture du listing d'affichage des astres.
import { fetchBodyListing } from '@/Car/api';
// Importe Group, le groupe de réglages.
import { Group } from '../../ui/Group.jsx';
// Importe fold, qui normalise un texte (minuscules, sans accents).
import { fold } from '@/Car/shared/lib/format';

/**
 * Catalogue des astres : planètes, planètes naines et satellites naturels.
 *
 * Cette composante ne contient aucune donnée d'astre. Rien n'y est écrit en dur : ni nom, ni rayon, ni couleur, ni
 * liste. Elle demande le listing au serveur (GET /bodies/listing) et n'affiche qu'une fois la réponse arrivée ;
 * tant qu'elle n'est pas là, une roue de chargement tient la place. Ce que le serveur renvoie fait foi : ajouter une
 * planète naine ou un satellite côté serveur le fait apparaître ici sans toucher au frontend.
 *
 * Elle est mutable : chaque ligne agit sur la scène — la case affiche ou enlève l'astre, le nom y emmène la caméra —
 * et le listing se relit à la demande, pour reprendre en compte ce que le serveur a appris depuis.
 */
// Déclare et exporte le composant CatalogueAstres (début de la liste des propriétés).
export function CatalogueAstres({
  // Les astres de la navigation, pour retrouver l'indice d'un nom : [{ index, name, hidden }].
  bodies = [],
  // Aller à un astre, par son indice.
  onSelect,
  // Afficher ou enlever un astre, par son indice.
  onBodyShown,
  // Rappel de fin : referme la fenêtre après un déplacement.
  onDone,
  // Référence du moteur 3D, pour découvrir et viser les systèmes extrasolaires.
  engineRef,
// Fin de la liste des propriétés.
}) {
  // État : le listing reçu du serveur, null tant qu'il n'est pas arrivé.
  const [listing, setListing] = useState(null);
  // État : le message d'erreur, null s'il n'y en a pas.
  const [error, setError] = useState(null);
  // État : compteur de relecture ; l'incrémenter redemande le listing.
  const [reload, setReload] = useState(0);
  const [interstellarQuery, setInterstellarQuery] = useState('Proxima Centauri');
  const [interstellarBusy, setInterstellarBusy] = useState(false);
  const [interstellarError, setInterstellarError] = useState(null);
  const [interstellarSystems, setInterstellarSystems] = useState([]);

  const loadInterstellar = async () => {
    const query = interstellarQuery.trim();
    if (!query) return;
    const engine = engineRef?.current;
    if (!engine?.loadInterstellarSystemByName) { setInterstellarError('Le moteur interstellaire n’est pas prêt.'); return; }
    setInterstellarBusy(true);
    setInterstellarError(null);
    try {
      const result = await engine.loadInterstellarSystemByName(query, { limit: 50 });
      if (!result?.ok) {
        setInterstellarError(result?.reason === 'system-not-resolved'
          ? `Aucun système non ambigu trouvé pour « ${query} ».`
          : (result?.warnings || []).join(' ') || 'Position globale indisponible.');
      } else {
        setInterstellarSystems(engine.getInterstellarSystems());
      }
    } catch (error) {
      setInterstellarError(error?.message || 'Recherche astronomique impossible. Vérifie la connexion aux archives publiques.');
    } finally { setInterstellarBusy(false); }
  };

  const focusInterstellar = (id) => {
    const engine = engineRef?.current;
    if (engine?.focusInterstellarSystem?.(id)) onDone?.();
  };

  // Demande le listing au montage, et à chaque relecture (début de l'effet).
  useEffect(() => {
    // Contrôleur d'abandon de la lecture en cours.
    const controller = new AbortController();
    // Efface l'erreur précédente.
    setError(null);
    // Demande le listing.
    fetchBodyListing(controller.signal)
      // Reçu : le garde.
      .then(setListing)
      // Échec, sauf annulation volontaire : garde le message, rien n'est affiché.
      .catch((e) => { if (e.name !== 'AbortError') setError(e.message || 'Listing indisponible'); });
    // Nettoyage : abandonne la lecture en cours.
    return () => controller.abort();
  // Fin de l'effet ; dépendance : le compteur de relecture.
  }, [reload]);

  /**
   * Indice de chaque astre dans la navigation, par son nom normalisé : c'est ce qui relie une ligne du listing à
   * l'astre du moteur. Le rapprochement se fait sur le nom, comme ailleurs dans l'app, sans table embarquée.
   */
  // Table des astres de la navigation, par nom normalisé (début du calcul mémorisé).
  const byName = useMemo(() => {
    // Table vide au départ.
    const map = new Map();
    // Pour chaque astre de la navigation : son nom normalisé mène à lui.
    for (const b of bodies) map.set(fold(b.name), b);
    // Renvoie la table.
    return map;
  // Fin du calcul ; dépendance : les astres de la navigation.
  }, [bodies]);

  // Ligne d'un astre : la pastille de sa couleur, son nom, ses étiquettes, et la case d'affichage (début).
  const Line = ({ name, color, badges, indent }) => {
    // L'astre correspondant dans la navigation, s'il y est.
    const body = byName.get(fold(name));
    // Début du rendu de la ligne.
    return (
      // Une ligne en pile horizontale, avec un retrait pour un satellite.
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, py: 1, pl: indent ? 4 : 1.5 }}>
        {/* La pastille de la couleur de l'astre, si le listing en donne une. */}
        <Box aria-hidden="true" sx={{ width: 10, height: 10, borderRadius: '50%', flex: 'none', bgcolor: color || 'text.disabled' }} />
        {/* Le nom, cliquable s'il correspond à un astre de la scène : il y emmène la caméra. */}
        <Typography
          // Le nom prend toute la largeur restante.
          sx={{ flex: 1, fontSize: 14, cursor: body ? 'pointer' : 'default', '&:hover': body ? { textDecoration: 'underline' } : {} }}
          // Au clic : va à l'astre, puis signale la fin.
          onClick={body ? () => { onSelect?.(body.index); onDone?.(); } : undefined}
        // Fin de la balise ouvrante.
        >
          {/* Le nom tel que le serveur l'écrit. */}
          {name}
        {/* Fin du nom. */}
        </Typography>
        {/* Les étiquettes de l'astre, telles que le listing les justifie. */}
        {badges.map((b) => <Chip key={b} size="small" variant="outlined" label={b} sx={{ height: 20, fontSize: 11 }} />)}
        {/* La case d'affichage, seulement pour un astre de la scène autre que le Soleil (indice 0). */}
        {body && body.index !== 0 && (
          <Checkbox
            // Petite taille, sans marge.
            size="small" sx={{ p: 0.25 }}
            // Cochée quand l'astre n'est pas enlevé.
            checked={!body.hidden}
            // Au changement : affiche ou enlève l'astre.
            onChange={(e) => onBodyShown?.(body.index, e.target.checked)}
            // Nom pour les lecteurs d'écran.
            inputProps={{ 'aria-label': `Afficher ${name}` }}
          // Fin de la case.
          />
        )}
      {/* Fin de la ligne. */}
      </Stack>
    // Fin du rendu.
    );
  // Fin de Line.
  };

  // Titre du groupe : les nombres du listing quand il est là, sinon le titre seul.
  const title = listing
    // Avec le listing : le nombre de planètes, de naines et de satellites, comptés par le serveur.
    ? `Astres · ${listing.counts.planets} planètes dont ${listing.counts.dwarfPlanets} naines, ${listing.counts.satellites} satellites`
    // Sans le listing : le titre seul.
    : 'Astres';

  // Début du rendu.
  return (
    // Groupe titré.
    <Group title={title}>
      {/* Tant que le listing n'est pas arrivé et qu'il n'y a pas d'erreur : la roue de chargement (début). */}
      {!listing && !error && (
        // Ligne centrée.
        <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} sx={{ py: 2 }}>
          {/* La roue. */}
          <CircularProgress size={16} />
          {/* Le texte d'attente. */}
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Lecture du listing des astres…</Typography>
        {/* Fin de la ligne. */}
        </Stack>
      )}
      {/* En cas d'échec : le message et un bouton de relecture (début). */}
      {error && (
        // Ligne du message.
        <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, py: 1.5 }}>
          {/* Le message, qui cite la cause. */}
          <Typography sx={{ flex: 1, fontSize: 13, color: 'text.secondary' }}>Listing des astres indisponible : {error}</Typography>
          {/* La pastille de relecture : incrémente le compteur, ce qui redemande le listing. */}
          <Chip size="small" variant="outlined" clickable label="Réessayer" onClick={() => setReload((n) => n + 1)} />
        {/* Fin de la ligne. */}
        </Stack>
      )}
      {/* Le listing reçu : une ligne par planète, suivie de ses satellites naturels en retrait (début). */}
      {listing?.planets.map((planet) => (
        // Un fragment par planète, repéré par son nom.
        <Box key={planet.name}>
          {/* La planète : sa couleur, son nom, et l'étiquette « naine » quand le serveur la marque ainsi. */}
          <Line name={planet.name} color={planet.color} badges={planet.dwarf ? ['naine'] : []} indent={false} />
          {/* Ses satellites naturels, en retrait. */}
          {planet.satellites.map((sat) => <Line key={sat.name} name={sat.name} color={sat.color} badges={[]} indent />)}
        {/* Fin de la planète. */}
        </Box>
      ))}
      {/* Fin du listing. */}
      <Box sx={{ mt: 2, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
        <Typography sx={{ px: 1.5, pb: 1, fontSize: 14, fontWeight: 600 }}>Systèmes extrasolaires</Typography>
        <Stack direction="row" spacing={1} sx={{ px: 1.5, pb: 1 }}>
          <TextField
            size="small" fullWidth value={interstellarQuery}
            onChange={(event) => setInterstellarQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && !interstellarBusy) loadInterstellar(); }}
            placeholder="Nom d’une étoile (ex. Proxima Centauri)"
            inputProps={{ 'aria-label': 'Rechercher un système extrasolaire' }}
          />
          <Button size="small" variant="contained" disabled={interstellarBusy || !interstellarQuery.trim()} onClick={loadInterstellar}>
            {interstellarBusy ? <CircularProgress size={18} color="inherit" /> : 'Rechercher'}
          </Button>
        </Stack>
        {interstellarError && <Alert severity="warning" sx={{ mx: 1.5, mb: 1, fontSize: 12 }}>{interstellarError}</Alert>}
        {interstellarSystems.map((system) => (
          <Stack key={system.id} direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, py: 0.75 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{system.name}</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                {system.distanceLightYears?.toFixed(2)} années-lumière · {system.state || 'chargement'}
              </Typography>
            </Box>
            <Chip size="small" clickable color="primary" label="Voir" onClick={() => focusInterstellar(system.id)} />
          </Stack>
        ))}
      </Box>
    {/* Fin du groupe. */}
    </Group>
  // Fin du rendu.
  );
// Fin de CatalogueAstres.
}
