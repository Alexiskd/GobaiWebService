// Crochets React.
import { useRef, useState } from 'react';
// Éléments d'interface.
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
// Lecture de l'en-tête du fichier LAS/LAZ, dans le navigateur.
import { inspectLasFile } from '@/moteur/contributions/lasHeader';
// Mises en forme.
import { formatBytes, formatCount } from './format';

/**
 * Choix d'un fichier LAS/LAZ et publication de son placement.
 *
 * Seul l'en-tête du fichier est lu, dans le navigateur : l'emprise, le nombre de points et le système de
 * coordonnées. Rien d'autre ne quitte l'appareil — un relevé LiDAR HD pèse plusieurs centaines de méga-octets et
 * reste chez son propriétaire. Le serveur calcule la position à partir de ces seules valeurs : en Lambert-93
 * (EPSG:2154, celui de l'IGN), le relevé se place tout seul au bon endroit du globe.
 */
export function LazAnalyse({ onPublish, disabled }) {
  // Le champ de fichier, pour pouvoir le vider.
  const input = useRef(null);
  // En-tête lu, ou null.
  const [info, setInfo] = useState(null);
  // Titre et note saisis.
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  // Appel en cours ?
  const [busy, setBusy] = useState(false);
  // Dernier message d'erreur.
  const [error, setError] = useState('');

  // Remet le formulaire à zéro.
  const reset = () => {
    // Efface l'en-tête et les textes.
    setInfo(null);
    setTitle('');
    setNote('');
    // Et le champ de fichier, pour pouvoir rechoisir le même.
    if (input.current) input.current.value = '';
  // Fin de reset.
  };

  // Lecture du fichier choisi.
  const onFile = async (event) => {
    // Le fichier.
    const file = event.target.files?.[0];
    // Aucun fichier : formulaire remis à zéro.
    if (!file) { reset(); return; }
    // Attente et effacement de l'erreur.
    setBusy(true);
    setError('');
    // Essaie la lecture.
    try {
      // En-tête lu dans le navigateur.
      const read = await inspectLasFile(file);
      // Gardé, le titre proposé étant le nom du fichier.
      setInfo(read);
      setTitle(read.filename.replace(/\.(copc\.)?la[sz]$/i, ''));
    // Fichier illisible : le message est montré tel quel.
    } catch (e) {
      // Formulaire remis à zéro et message affiché.
      reset();
      setError(e.message || 'Fichier illisible.');
    // Dans tous les cas.
    } finally {
      // Fin de l'attente.
      setBusy(false);
    // Fin de l'essai.
    }
  // Fin de onFile.
  };

  // Publication du placement.
  const publish = async () => {
    // Rien à publier.
    if (!info) return;
    // Attente et effacement de l'erreur.
    setBusy(true);
    setError('');
    // Essaie.
    try {
      // Le serveur calcule la position et enregistre le placement.
      await onPublish({ info, title: title.trim(), note: note.trim() });
      // Formulaire remis à zéro.
      reset();
    // Refus du serveur.
    } catch (e) {
      // Message.
      setError(e.message || 'Publication impossible.');
    // Dans tous les cas.
    } finally {
      // Fin de l'attente.
      setBusy(false);
    // Fin de l'essai.
    }
  // Fin de publish.
  };

  // Début du rendu.
  return (
    // Bloc du dépôt de fichier.
    <Box sx={{ display: 'grid', gap: 1 }}>
      {/* Ce que fait ce bloc. */}
      <Typography variant="body2" color="text.secondary">
        {/* Le texte. */}
        Choisissez une dalle LiDAR HD de l’IGN (.laz, .copc.laz) ou un relevé .las : son en-tête est lu ici même, et sa
        position est calculée à partir de ses coordonnées. Le fichier n’est pas envoyé.
      {/* Fin du texte. */}
      </Typography>
      {/* Le champ de fichier. */}
      <Box
        component="input"
        ref={input}
        type="file"
        accept=".las,.laz"
        aria-label="Fichier LAS ou LAZ"
        disabled={disabled || busy}
        onChange={onFile}
        sx={{ fontSize: '0.875rem' }}
      />
      {/* Si un en-tête a été lu : ce qu'il dit, puis le formulaire de publication. */}
      {info && (
        // Résumé et formulaire.
        <Box sx={{ display: 'grid', gap: 1 }}>
          {/* Ce que dit l'en-tête. */}
          <Typography variant="body2">
            {/* Version, points, taille et système déclaré. */}
            LAS {info.version}{info.compressed ? ' compressé' : ''} · {formatCount(info.pointCount)} points · {formatBytes(info.sizeBytes)}
            {info.epsg ? ` · EPSG:${info.epsg} déclaré` : info.crsWkt ? ' · système décrit en WKT' : ' · aucun système déclaré'}
          {/* Fin du résumé. */}
          </Typography>
          {/* Titre du placement. */}
          <TextField size="small" label="Titre" value={title} onChange={(e) => setTitle(e.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} />
          {/* Note libre. */}
          <TextField size="small" label="Note (facultatif)" value={note} onChange={(e) => setNote(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} multiline minRows={2} />
          {/* Les deux boutons. */}
          <Stack direction="row" spacing={1}>
            {/* Publication. */}
            <Button variant="outlined" size="small" disabled={disabled || busy} onClick={publish}>Publier le placement</Button>
            {/* Abandon. */}
            <Button size="small" disabled={busy} onClick={reset}>Annuler</Button>
          {/* Fin des boutons. */}
          </Stack>
        {/* Fin du résumé et du formulaire. */}
        </Box>
      )}
      {/* Message d'erreur. */}
      {error && <Alert severity="error" role="alert">{error}</Alert>}
    {/* Fin du bloc. */}
    </Box>
  // Fin du rendu.
  );
// Fin de LazAnalyse.
}
