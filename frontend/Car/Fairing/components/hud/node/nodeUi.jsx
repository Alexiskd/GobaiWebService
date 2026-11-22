// Briques de style communes à tous les onglets de la fenêtre Node. Avant, chaque onglet redéclarait son propre titre
// de section, son bloc de formule et son étiquette : sept copies qui divergeaient. Tout onglet se compose désormais
// des mêmes pièces — Section, Carte, Chiffre, Formule, Etiquette, Note, Fiche — pour une seule apparence.
// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { Table, TableBody, TableCell, TableHead, TableRow, cx } from '@/Fairing/kit';
// Importe les conversions des valeurs de style calculées au rendu.
import { sz, tok } from '@/Fairing/kit/sx';

// Police à chasse fixe des formules, des adresses et des nombres alignés.
export const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/**
 * Section d'un onglet : un numéro d'ordre à chasse fixe, le titre, un sous-titre facultatif, puis le contenu.
 * Le numéro sert de repère de lecture dans les onglets longs (la théorie quantique en compte huit).
 */
// Déclare et exporte Section : numéro, titre, sous-titre, action à droite du titre et contenu.
export function Section({ numero, titre, sousTitre, action, children, className }) {
  // Début du rendu.
  return (
    // La section, séparée de ce qui précède par une marge ; seule une section placée en tête d'onglet n'en a pas.
    <section aria-label={titre} className={cx('mt-8 first:mt-1 min-w-0', className)}>
      {/* En-tête : numéro, titre et action, soulignés d'un trait fin. */}
      <div className="flex items-baseline gap-2.5 pb-1.5 mb-3 border-b border-line">
        {/* Le numéro d'ordre, s'il y en a un. */}
        {numero != null && (
          <span aria-hidden="true" className="font-mono text-[0.75rem] text-primary flex-none">
            {String(numero).padStart(2, '0')}
          </span>
        )}
        {/* Le titre et son sous-titre. */}
        <div className="flex-1 min-w-0">
          <h3 className="t-subtitle1 font-bold leading-[1.3] [overflow-wrap:anywhere]">{titre}</h3>
          {sousTitre && <p className="t-body2 text-soft mt-0.5">{sousTitre}</p>}
        </div>
        {/* L'action facultative (compteur, bouton). */}
        {action}
      </div>
      {/* Le contenu de la section. */}
      {children}
    </section>
  );
// Fin de Section.
}

/** Sous-titre à l'intérieur d'une section. */
// Déclare et exporte SousTitre : reçoit un contenu.
export const SousTitre = ({ children, className }) => (
  // Titre de niveau 4, petites capitales espacées, couleur secondaire.
  <h4 className={cx('t-overline text-soft block leading-[1.8] mt-5 mb-1.5', className)}>
    {children}
  </h4>
);

/** Surface bordée : regroupe un dessin, un tableau ou un bloc de texte. `accent` colore le bord gauche. */
// Déclare et exporte Carte : couleur d'accent facultative, contenu et style.
export const Carte = ({ accent, children, className, style, ...rest }) => (
  // Boîte à bordure fine et fond léger ; le bord gauche prend la couleur d'accent si elle est donnée.
  <div
    {...rest}
    className={cx('g-carte', accent && 'border-l-3', className)} style={accent ? { borderLeftColor: tok(accent), ...style } : style}
  >
    {children}
  </div>
);

/** Grille de chiffres clés : autant de colonnes que la largeur le permet. */
// Déclare et exporte GrilleChiffres : largeur minimale d'une colonne et contenu.
export const GrilleChiffres = ({ min = 150, children, className }) => (
  // Grille qui se replie toute seule sur téléphone.
  <div className={cx('grid gap-2', className)} style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))` }}>{children}</div>
);

/** Chiffre clé : un libellé, une valeur en grand (chiffres alignés) et une précision facultative. */
// Déclare et exporte Chiffre : libellé, valeur, précision et couleur de la valeur.
export const Chiffre = ({ libelle, valeur, detail, couleur = 'text.primary' }) => (
  // La tuile du chiffre.
  <Carte className="p-3">
    {/* Le libellé, en petit. */}
    <span className="t-caption text-soft block leading-[1.3]">{libelle}</span>
    {/* La valeur, en grand, à chiffres de largeur fixe. */}
    <p className="t-body1 mt-1 text-[1.15rem] font-bold leading-[1.2] tabular-nums [overflow-wrap:anywhere]" style={{ color: tok(couleur) }}>{valeur}</p>
    {/* La précision, si elle existe. */}
    {detail && <span className="t-caption text-soft block mt-1 leading-[1.35]">{detail}</span>}
  </Carte>
);

/** Formule ou bloc de code : chasse fixe, bord gauche coloré, retour à la ligne automatique. */
// Déclare et exporte Formule : reçoit un contenu.
export const Formule = ({ children, className }) => (
  // Bloc préformaté qui ne déborde jamais en largeur.
  <pre
    className={cx('m-0 px-3 py-2 rounded-[10px] border border-line border-l-3 border-l-primary bg-hover font-mono text-[0.82rem] leading-[1.55] whitespace-pre-wrap [overflow-wrap:anywhere]', className)}
  >
    {children}
  </pre>
);

/** Étiquette à bordure : un nom court (source, service, branche). `couleur` la teinte. */
// Déclare et exporte Etiquette : couleur facultative et contenu.
export const Etiquette = ({ couleur, children, className }) => (
  // Balise en ligne, coupée au besoin.
  <span
    className={cx('inline-block max-w-full [overflow-wrap:anywhere] text-[0.8em] font-semibold leading-[1.5] px-1.5 py-px border rounded-[6px]', className)} style={{ borderColor: tok(couleur || 'divider'), color: tok(couleur || 'inherit') }}
  >
    {children}
  </span>
);

/** Texte d'explication, en couleur secondaire. */
// Déclare et exporte Note : reçoit un contenu.
export const Note = ({ children, className }) => (
  // Paragraphe secondaire, limité en largeur pour rester lisible.
  <p className={cx('t-body2 text-soft mt-2 max-w-[78ch] leading-[1.6]', className)}>{children}</p>
);

/** Mise en garde ou remarque importante : une carte au bord coloré. */
// Déclare et exporte Alerte : titre, couleur et contenu.
export const Alerte = ({ titre, couleur = 'warning.main', children, className }) => (
  // La carte de la remarque.
  <Carte accent={couleur} className={cx('mt-3', className)}>
    {/* Le titre, s'il y en a un. */}
    {titre && <h6 className="t-subtitle2 font-bold mb-0.5">{titre}</h6>}
    {/* Le texte. */}
    <p className="t-body2 text-soft leading-[1.6]">{children}</p>
  </Carte>
);

/**
 * Tableau de la fenêtre Node. `colonnes` : [{ titre, align, largeur, cache }] ; `lignes` : tableaux de cellules.
 * `fixe` coupe les textes longs au lieu d'élargir le tableau (aucun défilement horizontal, même sur téléphone) ;
 * sans `fixe`, le tableau défile dans son cadre quand il est plus large que la fenêtre.
 * `cache: true` masque la colonne sur téléphone.
 */
// Déclare et exporte Fiche : colonnes, lignes, mode fixe, libellé accessible et style.
export function Fiche({ colonnes, lignes, fixe = false, label, className }) {
  // Une colonne au moins a-t-elle un titre ? Sinon l'en-tête n'est pas rendu.
  const entete = colonnes.some((c) => c.titre);
  // masque : style d'une cellule de colonne masquée sur téléphone.
  const masque = (c) => (c.cache ? 'hidden min-[600px]:table-cell' : undefined);
  // Début du rendu.
  return (
    // Cadre du tableau : défilement horizontal seulement en mode libre.
    <div className={`max-w-full ${fixe ? 'overflow-x-hidden' : 'overflow-x-auto'}`}>
      <Table size="small" aria-label={label} className={cx('g-fiche', className)} data-fixed={fixe ? '' : undefined}>
        {/* L'en-tête, si des titres sont donnés. */}
        {entete && (
          <TableHead>
            <TableRow>
              {colonnes.map((c, i) => (
                <TableCell key={i} align={c.align} className={cx('leading-[1.3] align-bottom', masque(c))} style={{ width: sz(c.largeur) }}>{c.titre}</TableCell>
              ))}
            </TableRow>
          </TableHead>
        )}
        {/* Le corps : une ligne par entrée, une cellule par colonne. */}
        <TableBody>
          {lignes.map((ligne, r) => (
            <TableRow key={r}>
              {colonnes.map((c, i) => (
                <TableCell key={i} align={c.align} className={cx(c.className, masque(c))} style={entete ? undefined : { width: sz(c.largeur) }}>{ligne[i]}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
// Fin de Fiche.
}

/** Petite ligne sous un nom : adresse, date, précision. Jamais traduite quand `brut` est vrai (adresses). */
// Déclare et exporte Precision : indicateur d'adresse brute, couleur et contenu.
export const Precision = ({ brut = false, couleur = 'text.secondary', children, className }) => (
  // Ligne en petit, coupée au besoin.
  <span translate={brut ? 'no' : undefined} className={cx('block text-[0.78em] [overflow-wrap:anywhere]', brut && 'font-mono', className)} style={{ color: tok(couleur) }}>
    {children}
  </span>
);
