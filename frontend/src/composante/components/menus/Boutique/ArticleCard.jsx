// Éléments d'interface.
import { Box, Button, Card, CardContent, Chip, Stack, TextField, Tooltip, Typography } from '@mui/material';
// Ce que l'article contient.
import { badgesOf } from './sections';

/**
 * Un article de la boutique : ce qu'il donne, son prix, et le bouton qui ouvre la page de paiement.
 *
 * `owned` : l'achat déjà fait pour cet article, s'il y en a un — le bouton le dit, sans empêcher de racheter
 * (utile pour une location à l'heure que l'on veut prolonger).
 */
export function ArticleCard({ product, owned, hours, onHours, onBuy, busy, canBuy, signedIn }) {
  // Ce que l'article contient.
  const badges = badgesOf(product);
  // Le bouton est-il cliquable ?
  const disabled = !canBuy || Boolean(busy);
  // Ce que le bouton dit quand il ne l'est pas.
  const why = !signedIn ? 'Connectez-vous pour acheter.' : !canBuy ? 'Le paiement n’est pas ouvert sur ce serveur.' : '';

  // Début du rendu.
  return (
    // La carte de l'article.
    <Card
      variant="outlined"
      sx={{
        // Fond transparent, en colonne, toute la hauteur de sa case.
        bgcolor: 'transparent', display: 'flex', flexDirection: 'column', height: '100%',
        // Liseré plus net quand l'article est déjà acquis.
        borderColor: owned ? 'primary.main' : 'divider',
      }}
    >
      {/* Son contenu, qui prend toute la hauteur. */}
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, '&:last-child': { pb: 2 } }}>
        {/* Intitulé et prix sur la même ligne. */}
        <Stack direction="row" alignItems="baseline" spacing={1}>
          {/* L'intitulé. */}
          <Typography component="h4" variant="subtitle2" sx={{ flex: 1, minWidth: 0 }}>{product.label}</Typography>
          {/* Le prix, à l'heure pour une location. */}
          <Typography variant="subtitle2" sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
            {/* Le montant. */}
            {product.price}{product.hourly ? ' / h' : ''}
          {/* Fin du prix. */}
          </Typography>
        {/* Fin de la ligne. */}
        </Stack>
        {/* Ce que l'article donne. */}
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{product.description}</Typography>
        {/* Les badges de contenu, et l'achat déjà fait. */}
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
          {/* Un badge par élément de contenu. */}
          {badges.map((b) => <Chip key={b} size="small" variant="outlined" label={b} />)}
          {/* Déjà acquis : la date de fin. */}
          {owned && (
            // Le badge de l'achat.
            <Chip
              size="small"
              color="primary"
              label={`acquis · jusqu’au ${new Date(owned.expiresAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`}
            />
          )}
        {/* Fin des badges. */}
        </Stack>
        {/* Les heures d'une location, et le bouton. */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 'auto', flexWrap: 'wrap', gap: 1 }}>
          {/* Pour une location : le nombre d'heures. */}
          {product.hourly && (
            // Le champ des heures.
            <TextField
              size="small"
              type="number"
              label="Heures"
              value={hours}
              onChange={(e) => onHours(e.target.value)}
              slotProps={{ htmlInput: { min: 1, max: 744, step: 1, 'aria-label': `Heures pour ${product.label}` } }}
              sx={{ width: 96 }}
            />
          )}
          {/* L'achat, avec une infobulle quand il est fermé. */}
          <Tooltip title={why}>
            {/* Balise span : l'infobulle fonctionne même quand le bouton est coupé. */}
            <Box component="span" sx={{ ml: 'auto' }}>
              {/* Le bouton. */}
              <Button size="small" variant="contained" disableElevation disabled={disabled} onClick={onBuy}>
                {/* Son libellé selon l'état. */}
                {busy ? 'Ouverture…' : product.hourly ? (owned ? 'Prolonger' : 'Louer') : (owned ? 'Racheter' : 'Acheter')}
              {/* Fin du bouton. */}
              </Button>
            {/* Fin de la balise span. */}
            </Box>
          {/* Fin de l'infobulle. */}
          </Tooltip>
        {/* Fin de la ligne. */}
        </Stack>
      {/* Fin du contenu. */}
      </CardContent>
    {/* Fin de la carte. */}
    </Card>
  // Fin du rendu.
  );
// Fin de ArticleCard.
}
