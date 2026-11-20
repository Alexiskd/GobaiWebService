// Box « Blend · Lune » des caractéristiques de la Lune, présentée comme la box « Fond de carte · Lune » : le modèle 3D
// complet de la Lune, reconstruit par le serveur à partir des couches de la carte réelle (couleurs NASA SVS × détail
// Kaguya) et de l'outil de relief (altitudes LOLA), puis enregistré dans BP. Une option par relief (×1, ×5, ×10) :
// à créer, en fabrication, ou enregistrée dans BP et téléchargeable.
// Hooks de React.
import { useCallback, useEffect, useState } from 'react';
// Composants MUI.
import { CircularProgress, IconButton, Tooltip } from '@mui/material';
// Appels de l'API et base des routes.
import { API_BASE, get, post } from '../../../../Computing/api/client.jsx';
// Groupe, note et option, comme la box des fonds de carte.
import { Group } from '../../ui/Group.jsx';
import { Hint } from '../../ui/Hint.jsx';
import { Radio } from '../../ui/Radio.jsx';
// Icônes : télécharger, créer.
import { DownloadIcon, PlayArrowIcon } from '../../ui/icons.jsx';

// Relecture de l'état pendant une fabrication.
const POLL_MS = 4000;
// Libellés des variantes.
const LABELS = { 1: 'Relief réel', 5: 'Relief × 5', 10: 'Relief × 10' };

/** Description d'une variante : enregistrée (taille, date), en fabrication, en échec, ou à créer. */
function describe(v) {
  if (v.building) return 'Fabrication en cours… (relief, carte réelle, puis enregistrement dans BP)';
  if (v.stored) {
    const size = `${(v.size / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
    const date = new Date(v.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `Enregistré dans BP · ${size} · ${date}`;
  }
  if (v.error) return `Échec : ${v.error}`;
  return 'Pas encore créé : lancer la fabrication';
}

/** Box « Blend · Lune ». */
export function MoonBlend() {
  // État renvoyé par GET /tiles/moon-blend/status, erreur de lecture, variante choisie.
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(false);
  const [chosen, setChosen] = useState(1);

  // Lit l'état.
  const read = useCallback(async (signal) => {
    try { setStatus(await get('/tiles/moon-blend/status', { signal })); setError(false); }
    catch (e) { if (e?.name !== 'AbortError') setError(true); }
  }, []);

  // Première lecture.
  useEffect(() => { const c = new AbortController(); read(c.signal); return () => c.abort(); }, [read]);
  // Relecture tant qu'une variante est en fabrication.
  const building = Boolean(status?.variants?.some((v) => v.building));
  useEffect(() => {
    if (!building) return undefined;
    const t = setInterval(() => read(), POLL_MS);
    return () => clearInterval(t);
  }, [building, read]);

  // Lance la fabrication d'une variante.
  const build = async (e) => {
    try { setStatus(await post(`/tiles/moon-blend/${e}`)); } catch { setError(true); }
  };

  return (
    <Group title="Blend · Lune">
      {/* Ce qu'est le blend, ou pourquoi il est indisponible. */}
      {error ? (
        <Hint>État du blend indisponible.</Hint>
      ) : status && !status.database ? (
        <Hint>Base BP non branchée (DATABASE_URL) : le blend ne peut pas être enregistré.</Hint>
      ) : (
        <Hint>
          <strong>Blend</strong> : modèle 3D complet de la Lune, carte réelle (couleurs NASA SVS · détail Kaguya) posée sur le relief LOLA,
          enregistré dans BP. S’ouvre dans Blender (Fichier › Importer › glTF).
        </Hint>
      )}
      {/* Une option par relief, avec son bouton : télécharger si elle est dans BP, créer sinon. */}
      {status?.database && status.variants.map((v) => (
        <Radio
          key={v.exaggeration}
          name="moon-blend"
          checked={chosen === v.exaggeration}
          onChange={() => setChosen(v.exaggeration)}
          label={LABELS[v.exaggeration] ?? `Relief × ${v.exaggeration}`}
          description={describe(v)}
          source="LOLA (relief) · NASA SVS + Kaguya (carte réelle) · BP"
          action={v.building ? (
            <CircularProgress size={18} sx={{ mt: 1.5, mr: 1.25 }} aria-label="Fabrication en cours" />
          ) : v.stored ? (
            <Tooltip title={`Télécharger le blend « ${LABELS[v.exaggeration]} » (.glb)`}>
              <IconButton size="small" component="a" href={`${API_BASE}/tiles/moon-blend/${v.exaggeration}/model.glb`} download aria-label="Télécharger le blend" sx={{ mt: 0.75, mr: 0.5 }}>
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Créer ce blend et l’enregistrer dans BP">
              <IconButton size="small" onClick={() => build(v.exaggeration)} aria-label="Créer le blend" sx={{ mt: 0.75, mr: 0.5 }}>
                <PlayArrowIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        />
      ))}
    </Group>
  );
}
