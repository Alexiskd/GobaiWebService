// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { Button } from '@/Fairing/kit';
// Importe les icônes du bouton (cerveau, lien externe).
import { OpenInNewIcon, PsychologyIcon } from '../../ui/icons.jsx';

/** Adresse du site d'entraînement de l'IA. */
export const ENTRAINEMENT_IA_URL = 'https://gobaispace.info';

/**
 * Bloc « Entraînement IA » : un bouton qui ouvre gobaispace.info. Le site s'ouvre dans un nouvel onglet : la scène 3D
 * et la fenêtre des paramètres restent telles quelles dans l'onglet d'origine.
 */
export function EntrainementIA() {
  return (
    <div role="group" aria-label="Entraînement IA">
      <span className="t-overline text-soft block leading-[2.2]">Entraînement IA</span>
      <div className="g-paper g-paper-outlined bg-transparent p-3 flex items-center justify-between gap-3 flex-wrap">
        <p className="t-body2 text-soft flex-[1_1_220px]">Entraîner l’IA sur le site gobaispace.info.</p>
        <Button
          component="a" href={ENTRAINEMENT_IA_URL} target="_blank" rel="noopener noreferrer"
          variant="contained" startIcon={<PsychologyIcon />} endIcon={<OpenInNewIcon fontSize="small" />}
          className="min-h-11 normal-case"
        >
          Entraînement IA
        </Button>
      </div>
    </div>
  );
}
