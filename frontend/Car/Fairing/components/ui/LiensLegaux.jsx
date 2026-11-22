// Liens vers les pages légales (mentions légales, confidentialité), servies en pages statiques sous /legal/.
// Affichés dans la fenêtre Node (un clic depuis la barre d'outils) et sur l'écran des appareils non compatibles,
// pour qu'ils restent accessibles directement et en permanence (loi LCEN, art. 6 III).

/** Les deux pages légales, dans l'ordre d'affichage. */
export const LIENS_LEGAUX = [
  { href: '/legal/mentions-legales.html', label: 'Mentions légales' },
  { href: '/legal/confidentialite.html', label: 'Confidentialité' },
];

/** Ligne de liens légaux, séparés par des points ; s'ouvrent dans un nouvel onglet pour ne pas quitter la scène. */
export function LiensLegaux({ className = '' }) {
  return (
    <nav aria-label="Informations légales" className={`flex flex-wrap gap-x-3 gap-y-1 text-[0.78rem] ${className}`}>
      {LIENS_LEGAUX.map((l, i) => (
        <span key={l.href} className="inline-flex items-center gap-3">
          {i > 0 && <span aria-hidden="true" className="opacity-50">·</span>}
          <a href={l.href} target="_blank" rel="noopener" className="underline underline-offset-2 hover:opacity-80">{l.label}</a>
        </span>
      ))}
    </nav>
  );
}
