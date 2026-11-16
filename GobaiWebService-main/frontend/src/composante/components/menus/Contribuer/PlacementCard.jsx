// Éléments d'interface.
import { Box, Button, Card, CardContent, Chip, IconButton, Stack, Typography } from '@mui/material';
// Mises en forme.
import { formatAge, formatCount, formatCrs, formatDegrees, formatMeters, formatTile, placementState } from './format';
// Icônes des deux voix.
import { VoteDownIcon, VoteUpIcon } from '../../ui/icons';

/**
 * Un placement publié : son titre, sa position calculée, sa dalle IGN, et les deux flèches de vote.
 * Le vote dit si le relevé est au bon endroit sur la carte ; une même flèche cliquée deux fois retire la voix.
 */
export function PlacementCard({ item, canVote, isAuthor, onVote, onRemove, onShow }) {
  // État du placement d'après les voix.
  const state = placementState(item.status);
  // Nom lisible de la dalle IGN, s'il y en a une.
  const tile = formatTile(item.tile);
  // Début du rendu.
  return (
    // La carte du placement.
    <Card component="article" variant="outlined" sx={{ bgcolor: 'transparent' }}>
      {/* Contenu : les votes à gauche, le placement à droite. */}
      <CardContent sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', '&:last-child': { pb: 2 } }}>
        {/* Colonne des votes, à la façon d'un fil de discussion. */}
        <Stack alignItems="center" sx={{ flex: 'none', width: 44 }}>
          {/* Voix pour : « ce relevé est bien placé ». */}
          <IconButton
            size="small"
            aria-label="Bien placé"
            aria-pressed={item.myVote === 1}
            disabled={!canVote}
            color={item.myVote === 1 ? 'success' : 'default'}
            onClick={() => onVote(1)}
          >
            {/* Flèche vers le haut. */}
            <VoteUpIcon fontSize="small" />
          {/* Fin du bouton. */}
          </IconButton>
          {/* Score net, en gras. */}
          <Typography variant="body2" sx={{ fontWeight: 600 }} aria-label={`Score ${item.score}`}>{item.score}</Typography>
          {/* Voix contre : « ce relevé est mal placé ». */}
          <IconButton
            size="small"
            aria-label="Mal placé"
            aria-pressed={item.myVote === -1}
            disabled={!canVote}
            color={item.myVote === -1 ? 'error' : 'default'}
            onClick={() => onVote(-1)}
          >
            {/* Flèche vers le bas. */}
            <VoteDownIcon fontSize="small" />
          {/* Fin du bouton. */}
          </IconButton>
        {/* Fin de la colonne des votes. */}
        </Stack>
        {/* Colonne du placement. */}
        <Box sx={{ flex: 1, minWidth: 0, display: 'grid', gap: 0.5 }}>
          {/* Titre et état. */}
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {/* Le titre. */}
            <Typography component="strong" variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>{item.title}</Typography>
            {/* L'état d'après les voix. */}
            <Chip size="small" variant="outlined" color={state.color} label={state.label} />
          {/* Fin de la ligne. */}
          </Stack>
          {/* Position calculée et dalle IGN. */}
          <Typography variant="body2">
            {/* Latitude, longitude, et dalle. */}
            {formatDegrees(item.anchor.lat, 'lat')} · {formatDegrees(item.anchor.lon, 'lon')}
            {tile ? ` · IGN LiDAR HD, ${tile}` : ' · hors de France métropolitaine'}
          {/* Fin de la position. */}
          </Typography>
          {/* Emprise, points et système de coordonnées. */}
          <Typography variant="caption" color="text.secondary">
            {/* Les côtés, le nombre de points et l'origine du système. */}
            {formatMeters(item.sizeMeters?.[0])} × {formatMeters(item.sizeMeters?.[1])} · {formatCount(item.pointCount)} points · {formatCrs(item.crs, item.crsSource)}
          {/* Fin de la ligne. */}
          </Typography>
          {/* Note du contributeur, si elle existe. */}
          {item.note && <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{item.note}</Typography>}
          {/* Auteur, âge et nom du fichier. */}
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {/* Qui, quand, et d'après quel fichier. */}
            Par {item.author?.name || 'un contributeur'} · {formatAge(item.createdAt)} · {item.filename}
          {/* Fin de la ligne. */}
          </Typography>
          {/* Actions : voir sur le globe, et retirer pour son auteur. */}
          <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 1 }}>
            {/* Amène la caméra sur le relevé. */}
            <Button size="small" onClick={() => onShow(item)}>Voir sur le globe</Button>
            {/* Retrait, réservé à l'auteur. */}
            {isAuthor && <Button size="small" color="error" onClick={() => onRemove(item)}>Retirer</Button>}
          {/* Fin des actions. */}
          </Stack>
        {/* Fin de la colonne du placement. */}
        </Box>
      {/* Fin du contenu. */}
      </CardContent>
    {/* Fin de la carte. */}
    </Card>
  // Fin du rendu.
  );
// Fin de PlacementCard.
}
