// Logo du fournisseur connecté (Claude, Mistral), pour la fenêtre et le bouton de l'assistant.
import { useState } from 'react';
import { Box } from '@mui/material';
import { PROVIDERS } from '@/Engine/shared/lib/assistantSession';

// Fichiers de logo absents du dossier public : notés une fois, pour ne pas les redemander à chaque rendu.
const missing = new Set();

/**
 * Logo d'un fournisseur : le fichier du dossier public (`PROVIDERS[id].logo`) ; s'il manque, une pastille à la
 * couleur du fournisseur portant son initiale. Décoratif : le nom du fournisseur est toujours écrit à côté, ou dans
 * le nom accessible du bouton.
 */
export function ProviderLogo({ provider, size = 20, sx }) {
  const p = PROVIDERS[provider];
  const [broken, setBroken] = useState(() => !p || missing.has(p.logo));
  if (!p) return null;
  const box = { display: 'block', flex: 'none', width: size, height: size, ...sx };
  if (!broken) {
    return (
      <Box component="img" src={p.logo} alt="" aria-hidden="true" width={size} height={size} draggable={false}
        onError={() => { missing.add(p.logo); setBroken(true); }}
        sx={{ ...box, objectFit: 'contain' }} />
    );
  }
  return (
    <Box component="span" aria-hidden="true" sx={{
      ...box, display: 'grid', placeItems: 'center', borderRadius: '28%', bgcolor: p.color, color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: 800, fontSize: Math.round(size * 0.58), lineHeight: 1,
    }}>{p.label[0]}</Box>
  );
}

/** Icônes du bouton de la barre d'outils : même forme que les icônes MUI (taille reçue dans `sx.fontSize`). */
const ClaudeMark = ({ sx }) => <ProviderLogo provider="claude" size={sx?.fontSize ?? 18} />;
const MistralMark = ({ sx }) => <ProviderLogo provider="mistral" size={sx?.fontSize ?? 18} />;
export const PROVIDER_MARKS = { claude: ClaudeMark, mistral: MistralMark };
