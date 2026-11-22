// Logo du fournisseur connecté (Claude, Mistral), pour la fenêtre et le bouton de l'assistant.
import { useState } from 'react';
// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { cx } from '@/Fairing/kit';
import { PROVIDERS } from '@/Engine/shared/lib/app/assistantSession';

// Fichiers de logo absents du dossier public : notés une fois, pour ne pas les redemander à chaque rendu.
const missing = new Set();

/**
 * Logo d'un fournisseur : le fichier du dossier public (`PROVIDERS[id].logo`) ; s'il manque, une pastille à la
 * couleur du fournisseur portant son initiale. Décoratif : le nom du fournisseur est toujours écrit à côté, ou dans
 * le nom accessible du bouton.
 */
export function ProviderLogo({ provider, size = 20, className, style }) {
  const p = PROVIDERS[provider];
  const [broken, setBroken] = useState(() => !p || missing.has(p.logo));
  if (!p) return null;
  const box = { display: 'block', flex: 'none', width: size, height: size, ...style };
  if (!broken) {
    return (
      <img src={p.logo} alt="" aria-hidden="true" width={size} height={size} draggable={false}
        onError={() => { missing.add(p.logo); setBroken(true); }}
        className={cx('object-contain', className)} style={box} />
    );
  }
  return (
    <span aria-hidden="true" className={cx('grid place-items-center rounded-[28%] text-white font-sys font-extrabold leading-none', className)} style={{ ...box, display: 'grid', backgroundColor: p.color, fontSize: Math.round(size * 0.58) }}>{p.label[0]}</span>
  );
}

/** Icônes du bouton de la barre d'outils : même forme que les icônes du kit (taille reçue dans `style.fontSize`). */
const ClaudeMark = ({ style }) => <ProviderLogo provider="claude" size={style?.fontSize ?? 18} />;
const MistralMark = ({ style }) => <ProviderLogo provider="mistral" size={style?.fontSize ?? 18} />;
export const PROVIDER_MARKS = { claude: ClaudeMark, mistral: MistralMark };
