// Importe le calcul des largeurs des tuiles (module sans JSX, testé à part).
import { largeurs } from './factsLayout.js';

/**
 * Caractéristiques d'un astre, en tuiles : le terme en petites capitales au-dessus, la valeur en gras et en
 * chiffres alignés, la note éventuelle en dessous. Deux tuiles par ligne quand la largeur le permet ; une
 * caractéristique longue (phase de la Lune, libration…) prend la ligne entière, et une tuile qui resterait seule
 * sur sa ligne s'étire pour ne pas laisser de trou.
 * Liste de définitions (dl / dt / dd) pour les lecteurs d'écran, comme l'ancienne présentation en lignes.
 */
export function Facts({ items }) {
  // Sans caractéristique : rien à afficher.
  if (!items?.length) return null;
  // La largeur de chaque tuile, calculée une fois pour la liste.
  const large = largeurs(items);
  return (
    <dl
      className="m-0 grid grid-cols-2 gap-1.5"
    >
      {items.map((item, i) => (
        <div
          key={item.term}
          className={`min-w-0 px-2.5 py-2 rounded-[16px] border border-line bg-hover ${large[i] ? 'col-[1_/_-1]' : ''}`}
        >
          {/* Le terme : petites capitales, couleur atténuée. */}
          <dt className="t-body1 text-[10.5px] leading-[1.3] font-bold tracking-[0.07em] uppercase text-soft [overflow-wrap:anywhere]">
            {item.term}
          </dt>
          <dd className="m-0 mt-[3.2px]">
            {/* La valeur : en gras, chiffres de même largeur pour que les valeurs en direct ne tremblent pas. */}
            <p className="t-body1 text-[14.5px] leading-[1.3] font-semibold tabular-nums [overflow-wrap:anywhere]">
              {item.value}
            </p>
            {/* La note éventuelle, sous la valeur. */}
            {item.note && (
              <span className="t-caption text-soft block mt-0.5 leading-[1.35] [overflow-wrap:anywhere]">
                {item.note}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
