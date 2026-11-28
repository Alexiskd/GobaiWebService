// Box « Pays de la Lune » des caractéristiques de la Lune : les pays imaginaires découpés d'après les alunissages
// (voir Engine/AstreSolideEngine/MoonEngine/moonCountries.jsx). Pour chacun : sa nation et ses fusées terrestres, sa
// capitale (un site réel), ses sites, et la descendance sémantique de son nom, du mot le plus ancien jusqu'au pays.

// Importe les pays de la Lune et le rattachement des sites d'alunissage.
import { MOON_COUNTRIES, landingSites } from '../../../../../Engine/AstreSolideEngine/MoonEngine/moonCountries.jsx';
// Importe Group, le groupe de lignes, et Hint, la note d'aide.
import { Group } from '../../../ui/Group.jsx';
import { Hint } from '../../../ui/Hint.jsx';

// Sites d'alunissage rattachés à un pays (données figées : calculés une fois).
const SITES = landingSites();

/** Box « Pays de la Lune ». */
// Déclare et exporte le composant MoonCountries (début).
export function MoonCountries() {
  // Début du rendu.
  return (
    // Groupe titré.
    <Group title="Pays de la Lune">
      {/* Ce que sont ces pays. */}
      <Hint>
        Découpage imaginaire : chaque point de la Lune revient au site d’alunissage le plus proche, et chaque site au pays
        dont la fusée l’a posé. Noms inventés ; sites, missions et fusées réels.
      </Hint>
      {/* Un bloc par pays (début). */}
      {MOON_COUNTRIES.map((c) => {
        // Ses sites.
        const sites = SITES.filter((s) => s.country === c.id).map((s) => s.name);
        // Le bloc.
        return (
          <div key={c.id} className="px-3 py-2.5">
            {/* Nom, pastille de couleur et nation terrestre. */}
            <div className="flex items-center gap-2">
              <span aria-hidden className="inline-block size-2.5 rounded-full" style={{ background: c.color }} />
              <span className="t-subtitle2">{c.name}</span>
              <span className="t-caption text-soft">· {c.earth}</span>
            </div>
            {/* Capitale, fusées et sites. */}
            <p className="t-caption text-soft mt-1">
              Capitale : {c.capital.name} ({c.capital.site}) · Fusées : {c.rockets.join(', ')} · {sites.length} site{sites.length > 1 ? 's' : ''} : {sites.join(', ')}
            </p>
            {/* Descendance sémantique du nom, du plus ancien au pays. */}
            <ol className="t-caption mt-1.5 flex flex-col gap-0.5" aria-label={`Descendance sémantique de ${c.name}`}>
              {c.descent.map((d, i) => (
                <li key={d.term}>
                  <span aria-hidden className="text-soft">{i === 0 ? '◦' : '↳'} </span>
                  <span className="font-medium">{d.term}</span>
                  <span className="text-soft"> — {d.meaning}</span>
                </li>
              ))}
            </ol>
          </div>
        );
      // Fin des pays.
      })}
    </Group>
  // Fin du rendu.
  );
// Fin de MoonCountries.
}
