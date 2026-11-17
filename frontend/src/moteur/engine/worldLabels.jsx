// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe lonLatToXYZ, la conversion d'une longitude et d'une latitude en point de la sphère, depuis tiles/mercator.
import { lonLatToXYZ } from './tiles/mercator';

// Taille d'une case de la grille de l'écran : 64 pixels.
const CELL = 64;                 // grille de l'écran pour tester les chevauchements rapidement
// Altitude maximale d'affichage des noms : 24 rayons terrestres.
const MAX_LABEL_ALTITUDE = 24;   // au-delà (en rayons terrestres), la Terre est trop petite pour des noms
// Vecteur de travail.
const v3 = new THREE.Vector3();
// Matrice de travail.
const inv = new THREE.Matrix4();

// Hiérarchie des noms de villes, à la manière des cartes de navigation : taille, graisse et point
// d'ancrage suivent l'importance du lieu. charW et h servent à réserver la place au sol dans la
// grille de chevauchement (voir SceneStyles.jsx pour le rendu).
// Niveaux d'importance des villes (début).
const TIERS = [
  // À partir de 8 millions d'habitants : caractères de 8,4 pixels, hauteur de 20.
  { minPop: 8e6, charW: 8.4, h: 20 },   // métropoles mondiales
  // À partir de 2 millions : 7,4 pixels, hauteur de 18.
  { minPop: 2e6, charW: 7.4, h: 18 },   // grandes villes
  // À partir de 300 000 : 6,7 pixels, hauteur de 17.
  { minPop: 3e5, charW: 6.7, h: 17 },   // villes moyennes
  // En dessous : 6,3 pixels, hauteur de 17.
  { minPop: 0,   charW: 6.3, h: 17 },   // petites villes, visibles seulement de près
// Fin des niveaux.
];
// Une capitale reste lisible même petite : jamais sous le niveau 1.
// tierOf : le niveau d'une ville (début).
const tierOf = (c) => {
  // Premier niveau dont la ville atteint la population.
  const i = TIERS.findIndex((t) => (c.pop || 0) >= t.minPop);
  // Aucun : le dernier niveau.
  const tier = i < 0 ? TIERS.length - 1 : i;
  // Une capitale est au pire au niveau 1.
  return c.capital ? Math.min(tier, 1) : tier;
// Fin de tierOf.
};
// Format compact des populations, en français, avec une décimale au plus.
const compactPop = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
// Largeur moyenne d'un caractère relative au latin : les idéogrammes ont une chasse pleine,
// l'arabe et l'hébreu sont plus compacts en raison des ligatures, le cyrillique est un peu plus large.
// Largeur relative d'un caractère selon l'écriture.
const SCRIPT_WIDTH = { japanese: 1.6, chinese: 1.6, korean: 1.6, arabic: 0.9, hebrew: 0.9, devanagari: 1, bengali: 1, cyrillic: 1.02 };

/** Nombre maximal de noms à l'écran selon l'altitude : peu de loin, beaucoup de près. */
// budgetFor : nombre maximal de noms selon l'altitude : 40 au-dessus de 2 rayons, 90 au-dessus de 0,5, sinon 180.
const budgetFor = (altitude) => (altitude > 2 ? 40 : altitude > 0.5 ? 90 : 180);

/**
 * Noms des villes du monde entier posés sur la Terre (étiquettes HTML, comme celles des planètes).
 * Les villes arrivent triées par population : on les parcourt dans cet ordre et on garde chaque nom qui ne chevauche
 * pas un nom déjà placé. Résultat : les grandes villes de loin, puis de plus en plus de villes en zoomant.
 * Un clic sur un nom y emmène la caméra (`onPick`).
 */
// Déclare et exporte la classe WorldLabels (début).
export class WorldLabels {
  /**
   * Options (réutilisé pour les lieux de la Lune) : className, maxAltitude (rayons de l'astre), budget(altitude),
   * revealAltitude pour n'apparaître qu'en zoomant (avec fadeAltitude pour le fondu), decorate(el, item) pour le
   * texte, la couleur et l'infobulle, tooltip pour une fiche au survol (show(city, el) / hide() / sync()).
   */
  // Constructeur : les options (début).
  constructor({
    // L'élément parent, la fonction de clic, la classe CSS, l'altitude maximale et le budget, avec leurs valeurs par défaut.
    parent, onPick, className = 'l map-label', maxAltitude = MAX_LABEL_ALTITUDE, budget = budgetFor,
    // L'altitude d'apparition, la longueur du fondu, la décoration, la hiérarchie et la fiche au survol.
    revealAltitude = Infinity, fadeAltitude = 0, decorate = null, tiered = false, tooltip = null,
  // Fin des options.
  }) {
    // Garde l'élément parent.
    this.parent = parent;
    // Garde la fonction de clic.
    this.onPick = onPick;
    // Garde la classe CSS.
    this.className = className;
    // Garde l'altitude maximale.
    this.maxAltitude = maxAltitude;
    // Garde le budget.
    this.budget = budget;
    // Garde l'altitude d'apparition.
    this.revealAltitude = revealAltitude;
    // Garde la longueur du fondu.
    this.fadeAltitude = fadeAltitude;
    // Garde la décoration.
    this.decorate = decorate;
    // Garde la hiérarchie.
    this.tiered = tiered;   // villes : hiérarchie de taille selon population / capitale
    // Garde la fiche au survol.
    this.tooltip = tooltip; // fiche au survol (CityCard), facultative
    // Liste des lieux : vide.
    this.items = [];
    // Réserve d'éléments HTML.
    this.pool = [];       // éléments DOM réutilisés
    // Visible.
    this.visible = true;
    // Nombre d'étiquettes affichées : 0.
    this.shownCount = 0;
  // Fin du constructeur.
  }

  // active : vrai quand les étiquettes sont visibles et qu'il y a des lieux.
  get active() { return this.visible && this.items.length > 0; }

  /** @param {{ name, native?, script?, lon, lat, pop, capital }[]} cities  triées de la plus peuplée à la moins peuplée */
  // setCities : reçoit les villes (début).
  setCities(cities) {
    // Pour chaque ville (début).
    this.items = cities.map((c) => {
      // Son point sur la sphère.
      const p = lonLatToXYZ(c.lon, c.lat);
      // Son libellé : le nom local, sinon le nom.
      const label = c.native || c.name;   // écriture locale quand Natural Earth la fournit
      // Son écriture, latine par défaut.
      const script = c.script || 'latin';
      // Le lieu (début).
      const item = {
        // Les champs de la ville, le libellé, l'écriture et les trois coordonnées.
        ...c, label, script, x: p[0], y: p[1], z: p[2],
        // Largeur estimée, un peu plus grande pour une capitale, et hauteur de 16 pixels.
        w: 14 + (c.capital ? 7 : 6.2) * label.length, h: 16,
      // Fin du lieu.
      };
      // Avec la hiérarchie (début).
      if (this.tiered) {
        // Son niveau : celui reçu, sinon calculé.
        const tier = c.tier ?? tierOf(c);
        // Les mesures de ce niveau.
        const m = TIERS[tier];
        // Range le niveau.
        item.tier = tier;
        // Largeur selon le niveau, la longueur du libellé et l'écriture.
        item.w = 16 + m.charW * label.length * (SCRIPT_WIDTH[script] || 1);
        // Hauteur du niveau.
        item.h = m.h;
      // Fin de ce cas.
      }
      // Renvoie le lieu.
      return item;
    // Fin de la boucle.
    });
  // Fin de setCities.
  }

  // setVisible : affiche ou masque les étiquettes (début).
  setVisible(on) {
    // Garde l'état.
    this.visible = on;
    // Si elles sont masquées (début).
    if (!on) {
      // Cache toutes les étiquettes.
      this.hideFrom(0);
      // Ferme la fiche.
      this.tooltip?.hide();
    // Fin de ce cas.
    }
  // Fin de setVisible.
  }

  // element : l'élément HTML numéro i, créé au besoin (début).
  element(i) {
    // Élément de la réserve.
    let el = this.pool[i];
    // S'il n'existe pas (début).
    if (!el) {
      // Le crée.
      el = document.createElement('div');
      // Sa classe CSS.
      el.className = this.className;
      // Caché au départ.
      el.style.display = 'none';
      // Au clic (début).
      el.addEventListener('click', (e) => {
        // Arrête la propagation.
        e.stopPropagation();
        // Ferme la fiche.
        this.tooltip?.hide();
        // Appelle la fonction de clic avec le lieu de l'étiquette.
        if (el.city) this.onPick?.(el.city);
      // Fin du clic.
      });
      // Avec une fiche au survol (début).
      if (this.tooltip) {
        // À l'entrée de la souris : ouvre la fiche du lieu.
        el.addEventListener('mouseenter', () => { if (el.city) this.tooltip.show(el.city, el); });
        // À la sortie : la ferme.
        el.addEventListener('mouseleave', () => this.tooltip.hide());
      // Fin de ce cas.
      }
      // L'ajoute au parent.
      this.parent.appendChild(el);
      // Le range dans la réserve.
      this.pool[i] = el;
    // Fin de la création.
    }
    // Renvoie l'élément.
    return el;
  // Fin de element.
  }

  // hideFrom : cache les étiquettes à partir du numéro n (début).
  hideFrom(n) {
    // Cache chacune des étiquettes affichées au-delà de n.
    for (let i = n; i < this.shownCount; i++) this.pool[i].style.display = 'none';
    // Le nombre affiché ne dépasse plus n.
    this.shownCount = Math.min(this.shownCount, n);
  // Fin de hideFrom.
  }

  /** @param {{ cam, W, H, earthMesh }} s  appelé à chaque image, après le placement de la caméra */
  // update : à chaque image ; reçoit la caméra, la taille de l'écran et la Terre (début).
  update({ cam, W, H, earthMesh }) {
    // Inactif : ferme la fiche et termine.
    if (!this.active) { this.tooltip?.hide(); return; }
    // Caméra dans le repère du maillage de la Terre (sphère unité, longitudes de lonLatToXYZ).
    // Met à jour la matrice de la Terre.
    earthMesh.updateWorldMatrix(true, false); // sans recalculer tout le sous-arbre (tuiles)
    // Cette matrice.
    const world = earthMesh.matrixWorld;
    // Position de la caméra dans le repère de la Terre.
    v3.copy(cam.position).applyMatrix4(inv.copy(world).invert());
    // Ses trois coordonnées.
    const cx = v3.x, cy = v3.y, cz = v3.z;
    // Altitude de la caméra, en rayons.
    const altitude = Math.hypot(cx, cy, cz) - 1;
    // Sous la surface ou trop loin : tout est caché.
    if (!(altitude > 0) || altitude > this.maxAltitude) { this.hideFrom(0); this.tooltip?.hide(); return; }
    // De loin, seuls les pays sont nommés : les villes n'apparaissent qu'en zoomant, en fondu.
    // Au-dessus de l'altitude d'apparition : tout est caché.
    if (altitude > this.revealAltitude) { this.hideFrom(0); this.tooltip?.hide(); return; }
    // Opacité : avec un fondu,
    const alpha = this.fadeAltitude > 0
      // l'avancement sous l'altitude d'apparition, entre 0 et 1 ;
      ? Math.max(0, Math.min(1, (this.revealAltitude - altitude) / this.fadeAltitude))
      // sinon 1.
      : 1;
    // Opacité négligeable : tout est caché.
    if (alpha <= 0.01) { this.hideFrom(0); this.tooltip?.hide(); return; }

    // Nombre maximal de noms à cette altitude.
    const budget = this.budget(altitude);
    // Grille des boîtes déjà posées, créée à la première image.
    const grid = this.grid || (this.grid = new Map());
    // La vide.
    grid.clear();
    // fits : vrai si une boîte ne chevauche aucune boîte posée (début).
    const fits = (x0, y0, x1, y1) => {
      // Pour chaque colonne de cases touchée (début).
      for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx++) {
        // Pour chaque ligne de cases touchée (début).
        for (let gy = Math.floor(y0 / CELL); gy <= Math.floor(y1 / CELL); gy++) {
          // Boîtes de cette case.
          const cell = grid.get(gx * 4096 + gy);
          // Si l'une d'elles chevauche la boîte : faux.
          if (cell && cell.some((b) => x0 < b[2] && b[0] < x1 && y0 < b[3] && b[1] < y1)) return false;
        // Fin de la boucle des lignes.
        }
      // Fin de la boucle des colonnes.
      }
      // Sinon vrai.
      return true;
    // Fin de fits.
    };
    // occupy : range une boîte dans la grille (début).
    const occupy = (box) => {
      // Pour chaque colonne de cases touchée (début).
      for (let gx = Math.floor(box[0] / CELL); gx <= Math.floor(box[2] / CELL); gx++) {
        // Pour chaque ligne de cases touchée (début).
        for (let gy = Math.floor(box[1] / CELL); gy <= Math.floor(box[3] / CELL); gy++) {
          // Clé de la case.
          const k = gx * 4096 + gy;
          // Ajoute la boîte à la case, créée au besoin.
          (grid.get(k) || grid.set(k, []).get(k)).push(box);
        // Fin de la boucle des lignes.
        }
      // Fin de la boucle des colonnes.
      }
    // Fin de occupy.
    };

    // Nombre d'étiquettes posées.
    let n = 0;
    // Pour chaque lieu, par ordre d'importance (début).
    for (const c of this.items) {
      // Budget atteint : arrêt.
      if (n >= budget) break;
      // Face visible : le point doit être devant l'horizon (p · cam > 1 sur la sphère unité), avec une petite marge.
      // Lieu derrière l'horizon : ignoré.
      if (c.x * cx + c.y * cy + c.z * cz <= 1.0001) continue;
      // Projection du lieu à l'écran.
      v3.set(c.x, c.y, c.z).applyMatrix4(world).project(cam);
      // Derrière le plan lointain ou hors de l'écran, avec 5 % de marge : ignoré.
      if (v3.z > 1 || v3.x < -1.05 || v3.x > 1.05 || v3.y < -1.05 || v3.y > 1.05) continue;
      // Le point d'ancrage est sur la ville : boîte centrée dessus pour les villes hiérarchisées.
      // Abscisse en pixels.
      const x = ((v3.x + 1) / 2) * W;
      // Ordonnée du point d'ancrage.
      const anchorY = ((1 - v3.y) / 2) * H;
      // Vrai pour un lieu hiérarchisé.
      const tiered = c.tier !== undefined;
      // Ordonnée de l'étiquette : centrée sur le point, ou 7 pixels au-dessus.
      const y = tiered ? anchorY - c.h / 2 : anchorY - 7;
      // Boîte réservée à l'étiquette.
      const box = tiered ? [x - 5, y - 2, x + c.w + 3, y + c.h] : [x - 4, y - 8, x + c.w + 4, y + 8];
      // Elle chevauche une étiquette déjà posée : ignorée.
      if (!fits(box[0], box[1], box[2], box[3])) continue;
      // Réserve la boîte.
      occupy(box);
      // L'élément HTML de cette position.
      const el = this.element(n);
      // S'il montrait un autre lieu (début).
      if (el.city !== c) {
        // Lui attache ce lieu.
        el.city = c;
        // Avec une décoration : elle écrit le contenu.
        if (this.decorate) this.decorate(el, c);
        // Sinon (début).
        else {
          // Texte : le libellé.
          el.textContent = c.label;
          // Écriture, pour le style CSS.
          el.dataset.script = c.script;
          // Avec une fiche au survol (début).
          if (this.tooltip) {
            // La fiche remplace l'infobulle native du navigateur.
            // Retire l'infobulle.
            el.removeAttribute('title');
            // Libellé pour les lecteurs d'écran : le nom, le pays et « fiche de la ville ».
            el.setAttribute('aria-label', `${c.name}${c.country ? `, ${c.country}` : ''} — fiche de la ville`);
          // Sans fiche (début).
          } else {
            // Population, en format compact.
            const pop = c.pop ? ` · ${compactPop.format(c.pop)} hab.` : '';
            // Nom local.
            const native = c.native ? ` · ${c.native}` : '';
            // Rang mondial.
            const rank = c.rank ? ` · n° ${c.rank} mondial` : '';
            // Infobulle : le nom, le nom local, le pays, la population, le rang et l'invitation à cliquer.
            el.title = `${c.name}${native}${c.country ? ` (${c.country})` : ''}${pop}${rank} · cliquer pour y aller`;
          // Fin du choix.
          }
        // Fin de ce cas.
        }
        // Lieu hiérarchisé : son niveau, pour le style CSS.
        if (tiered) el.dataset.tier = c.tier;
      // Fin du changement de lieu.
      }
      // Écriture DOM seulement si l'étiquette a bougé (≥ 0,05 px) : souvent aucune quand la vue est immobile.
      // Si la position a bougé de plus de 0,05 pixel (début).
      if (el._x === undefined || Math.abs(el._x - x) > 0.05 || Math.abs(el._y - y) > 0.05) {
        // Mémorise la position.
        el._x = x; el._y = y;
        // Déplace l'élément par une translation CSS.
        el.style.transform = `translate(${x}px,${y}px)`;
      // Fin de ce cas.
      }
      // Pendant le fondu (début).
      if (alpha < 1) {
        // Si l'opacité a changé (début).
        if (el._alpha !== alpha) {
          // L'écrit.
          el.style.opacity = alpha;
          // La mémorise.
          el._alpha = alpha;
        // Fin de ce cas.
        }
      // Hors fondu, si une opacité avait été écrite (début).
      } else if (el._alpha !== undefined) {
        // La retire.
        el.style.opacity = '';
        // L'oublie.
        el._alpha = undefined;
      // Fin de ce cas.
      }
      // Montre l'élément s'il n'était pas affiché.
      if (n >= this.shownCount) el.style.display = 'block';
      // Une étiquette de plus.
      n++;
    // Fin de la boucle.
    }
    // Cache les étiquettes en trop.
    this.hideFrom(n);
    // Mémorise le nombre affiché.
    this.shownCount = n;
    // Recale la fiche au survol.
    this.syncTooltip();
  // Fin de update.
  }

  /** La fiche reste accrochée à sa ville quand les étiquettes sont recyclées ; elle se ferme si la ville disparaît. */
  // syncTooltip : garde la fiche accrochée à sa ville (début).
  syncTooltip() {
    // La fiche.
    const tip = this.tooltip;
    // Sans fiche ouverte : rien à faire.
    if (!tip || !tip.city) return;
    // Étiquette affichée qui montre la ville de la fiche.
    const anchor = this.pool.find((el, i) => i < this.shownCount && el.style.display !== 'none' && el.city === tip.city);
    // Aucune : la fiche est fermée.
    if (!anchor) { tip.hide(); return; }
    // La fiche s'accroche à cette étiquette.
    tip.anchor = anchor;
    // Elle se replace.
    tip.sync();
  // Fin de syncTooltip.
  }

  // dispose : libère tout (début).
  dispose() {
    // Ferme la fiche.
    this.tooltip?.hide();
    // Retire tous les éléments de la page.
    this.pool.forEach((el) => el.remove());
    // Vide la réserve.
    this.pool = [];
    // Vide les lieux.
    this.items = [];
  // Fin de dispose.
  }
// Fin de la classe WorldLabels.
}
